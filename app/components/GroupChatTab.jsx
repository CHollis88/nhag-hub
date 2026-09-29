"use client";

import { useEffect, useState, useCallback } from "react";
import MessageThreadView from "./MessageThreadView";
import { useAdaptivePolling, messagesSignature } from "@/lib/useAdaptivePolling";
import { useConfirm } from "./ConfirmDialog";
import { useAction } from "./useAction";
import { requestJson } from "@/lib/request";
import { mergeLatest, prependOlder } from "@/lib/messagePaging";

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
  // v71 #44: only the newest page is fetched (and polled); older messages load
  // on request and are kept when the newest page refreshes.
  const [hasEarlier, setHasEarlier] = useState(false);
  const [muted, setMuted] = useState(false);

  const confirm = useConfirm();
  const run = useAction();

  // Polled every 10-30 s: a failed poll stays quiet (no toast every few
  // seconds while offline) and simply tries again next time.
  const loadMessages = useCallback(async () => {
    try {
      const data = await requestJson(`/api/groups/${groupId}/chat/${channel}/messages`);
      // Merge onto what's already loaded so a poll never throws away older
      // messages the person has scrolled back to read. Whether OLDER ones exist
      // is only learned from the first page or a "load earlier" -- not from a poll.
      setMessages((current) => {
        if (current === null) setHasEarlier(Boolean(data.has_more));
        return mergeLatest(current, data.messages);
      });
      return messagesSignature(data.messages);
    } catch {
      return undefined;
    }
  }, [groupId, channel]);

  useEffect(() => {
    setMessages(null);
    setHasEarlier(false);
    loadMessages();
    // Marking read is housekeeping -- never worth interrupting anyone over.
    requestJson(`/api/groups/${groupId}/chat/${channel}`, { method: "PATCH", body: { mark_read: true } }).catch(() => {});
  }, [groupId, channel, loadMessages]);

  // 10 s while messages are flowing, 30 s after 2 quiet minutes, paused
  // while the page is hidden (see lib/useAdaptivePolling).
  const nudgePolling = useAdaptivePolling(loadMessages, { resetKey: `${groupId}:${channel}` });

  // The "Load earlier messages" button: the page older than the oldest shown.
  const loadEarlier = async () => {
    const oldest = messages?.[0]?.created_at;
    if (!oldest) return;
    const { ok, data } = await run(() =>
      requestJson(`/api/groups/${groupId}/chat/${channel}/messages?before=${encodeURIComponent(oldest)}`)
    );
    if (!ok) return; // useAction has shown the reason; the button stays for a retry
    setMessages((current) => prependOlder(current, data.messages));
    setHasEarlier(Boolean(data.has_more));
  };

  // Throws on failure -- MessageThreadView keeps the text in the box and
  // shows the reason next to the composer (v71 #14).
  const send = async (body) => {
    await requestJson(`/api/groups/${groupId}/chat/${channel}/messages`, { method: "POST", body: { body } });
    nudgePolling(); // refresh now and go back to the fast rate
  };

  const react = async (messageId, emoji) => {
    const { ok } = await run(() =>
      requestJson(`/api/messages/group_chat/${messageId}/reactions`, { method: "POST", body: { emoji } })
    );
    if (ok) loadMessages();
  };

  // Optimistic; put back (and say so) if the server refuses.
  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    const { ok } = await run(() =>
      requestJson(`/api/groups/${groupId}/chat/${channel}`, { method: "PATCH", body: { muted: next } })
    );
    if (!ok) setMuted(!next);
  };

  // Leader/admin-only, regardless of channel -- wipes this channel's
  // messages but leaves the channel itself (and the other one, if the
  // ministry has both) on and usable.
  const clearChat = async () => {
    const which = channel === "leaders" ? "Leaders Only" : "Members";
    const yes = await confirm({
      title: `Clear the ${which} chat?`,
      message: "Every message in this channel is removed for everyone. The channel itself stays. This can't be undone.",
      confirmLabel: "Clear messages",
    });
    if (!yes) return;
    const { ok } = await run(
      () => requestJson(`/api/groups/${groupId}/chat/${channel}/messages`, { method: "DELETE" }),
      { success: "Messages cleared" }
    );
    if (ok) loadMessages();
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
          hasEarlier={hasEarlier}
          onLoadEarlier={loadEarlier}
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
