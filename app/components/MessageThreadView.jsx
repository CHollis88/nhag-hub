"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bell, BellOff } from "lucide-react";
import { SkeletonList } from "./Skeleton";
import MessageReactions from "./MessageReactions";

// Shared by DirectMessagesTab (one thread) and GroupChatTab (one channel)
// -- both are "a list of messages plus a compose box," identical in
// shape once the messages/send/react/mute callbacks are supplied.
export default function MessageThreadView({
  messages,
  currentUserId,
  onSend,
  onReact,
  muted,
  onToggleMute,
  emptyText = "No messages yet — say hello.",
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    await onSend(body.trim());
    setBody("");
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end px-5 pt-2">
        <button
          onClick={onToggleMute}
          className="flex items-center gap-1.5 text-xs text-inkfaint"
          title={muted ? "Unmute notifications" : "Mute notifications"}
        >
          {muted ? <BellOff size={14} /> : <Bell size={14} />}
          {muted ? "Muted" : "Notifications on"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
        {messages === null && <SkeletonList count={3} />}
        {messages?.length === 0 && <p className="text-sm text-inkfaint text-center mt-6">{emptyText}</p>}
        {messages?.map((m) => {
          const isMine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                {!isMine && <p className="text-xs text-inkfaint mb-0.5">{m.users?.display_name}</p>}
                <div
                  className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                    isMine ? "bg-accent text-white rounded-br-sm" : "bg-card border border-line rounded-bl-sm"
                  }`}
                >
                  {m.body}
                </div>
                <p className="text-[0.625rem] text-inkfaint mt-0.5">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
                <MessageReactions
                  reactions={m.reactions}
                  currentUserId={currentUserId}
                  onToggle={(emoji) => onReact(m.id, emoji)}
                />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 px-5 py-3 border-t border-linesoft flex-shrink-0">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message..."
          className="sp-input flex-1"
        />
        <button type="submit" disabled={!body.trim() || sending} className="sp-btn-primary p-2.5 disabled:opacity-50">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
