"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import MessageThreadView from "./MessageThreadView";

// Group Chat (feature key "group_chat"). Two channels, both built now
// per Cam's decision even though only "leaders" is expected to see real
// use at first: "members" (everyone active in the group) and "leaders"
// (that group's own leaders/admins only). Regular members only ever see
// the members channel; a leader/admin can switch between both.
export default function GroupChatTab({ groupId, currentUserId, canManage, initialChannel }) {
  const [channel, setChannel] = useState(initialChannel === "leaders" && canManage ? "leaders" : "members");
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

  return (
    <div className="h-full flex flex-col">
      {canManage && (
        <div className="flex gap-2 px-5 pt-4">
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
      {!canManage && <h2 className="font-serif text-2xl text-ink px-5 pt-4">Chat</h2>}
      <MessageThreadView
        messages={messages}
        currentUserId={currentUserId}
        onSend={send}
        onReact={react}
        muted={muted}
        onToggleMute={toggleMute}
        emptyText={channel === "leaders" ? "No leader chat yet — say hello." : "No messages yet — say hello."}
      />
    </div>
  );
}
