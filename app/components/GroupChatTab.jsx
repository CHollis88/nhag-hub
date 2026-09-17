"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import MessageThreadView from "./MessageThreadView";

// Group Chat (feature keys "chat_members" and "chat_leaders" -- each
// independently toggleable per Cam's decision, e.g. a ministry can turn
// on Leaders Only without turning on Members chat at all). "members"
// (everyone active in the group) and "leaders" (that group's own
// leaders/admins only). Regular members only ever see the members
// channel; a leader/admin can switch between both when both are on.
export default function GroupChatTab({
  groupId,
  currentUserId,
  canManage,
  hasMembersChannel,
  hasLeadersChannel,
  initialChannel,
}) {
  // Only a leader/admin with BOTH channels turned on ever sees a
  // switcher -- with just one channel enabled there's nothing to switch
  // between, so it defaults straight to whichever one actually exists.
  const canSwitch = canManage && hasMembersChannel && hasLeadersChannel;
  const defaultChannel = hasMembersChannel ? "members" : "leaders";
  const [channel, setChannel] = useState(() => {
    if (initialChannel === "leaders" && canManage && hasLeadersChannel) return "leaders";
    if (initialChannel === "members" && hasMembersChannel) return "members";
    return defaultChannel;
  });
  const [messages, setMessages] = useState(null);
  const [muted, setMuted] = useState(false);
  const pollRef = useRef(null);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/chat/${channel}/messages`);
    const data = await res.json();
    if (res.ok) setMessages(data.messages);
  }, [groupId, channel]);

  useEffect(() => {
    setMessages(null);
    loadMessages();
    fetch(`/api/groups/${groupId}/chat/${channel}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_read: true }),
    });
  }, [groupId, channel, loadMessages]);

  useEffect(() => {
    pollRef.current = setInterval(loadMessages, 4000);
    return () => clearInterval(pollRef.current);
  }, [loadMessages]);

  const send = async (body) => {
    await fetch(`/api/groups/${groupId}/chat/${channel}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    loadMessages();
  };

  const react = async (messageId, emoji) => {
    await fetch(`/api/messages/group_chat/${messageId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    loadMessages();
  };

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    await fetch(`/api/groups/${groupId}/chat/${channel}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ muted: next }),
    });
  };

  // Leader/admin-only, regardless of channel -- wipes this channel's
  // messages but leaves the channel itself (and the other one, if the
  // ministry has both) on and usable.
  const clearChat = async () => {
    if (!confirm(`Clear all messages in ${channel === "leaders" ? "Leaders Only" : "Members"} chat? This can't be undone.`)) return;
    await fetch(`/api/groups/${groupId}/chat/${channel}/messages`, { method: "DELETE" });
    loadMessages();
  };

  return (
    <div className="h-full min-h-0 flex flex-col">
      {canSwitch && (
        <div className="flex gap-2 px-5 pt-4 flex-shrink-0">
          <button
            onClick={() => setChannel("members")}
            className={channel === "members" ? "sp-btn-primary text-sm py-1.5 px-3" : "sp-btn-secondary text-sm py-1.5 px-3"}
          >
            Members
          </button>
          <button
            onClick={() => setChannel("leaders")}
            className={channel === "leaders" ? "sp-btn-primary text-sm py-1.5 px-3" : "sp-btn-secondary text-sm py-1.5 px-3"}
          >
            Leaders Only
          </button>
        </div>
      )}
      {!canSwitch && (
        <h2 className="font-serif text-2xl text-ink px-5 pt-4 flex-shrink-0">
          {channel === "leaders" ? "Leaders Chat" : "Chat"}
        </h2>
      )}
      <div className="flex-1 min-h-0">
        <MessageThreadView
          messages={messages}
          currentUserId={currentUserId}
          onSend={send}
          onReact={react}
          muted={muted}
          onToggleMute={toggleMute}
          onClear={canManage ? clearChat : undefined}
          emptyText={channel === "leaders" ? "No leader chat yet — say hello." : "No messages yet — say hello."}
        />
      </div>
    </div>
  );
}
