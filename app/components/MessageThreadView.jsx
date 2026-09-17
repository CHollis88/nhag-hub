"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bell, BellOff, MoreVertical } from "lucide-react";
import { SkeletonList } from "./Skeleton";
import MessageReactions from "./MessageReactions";

const EMOJI_SET = ["👍", "❤️", "🙏", "😂"];
const LONG_PRESS_MS = 450;

// Shared by DirectMessagesTab (one thread) and GroupChatTab (one channel)
// -- both are "a list of messages plus a compose box," identical in
// shape once the messages/send/react/mute callbacks are supplied.
//
// Reactions work GroupMe-style: existing reactions show as small pills
// overlapping the bubble's bottom corner (see MessageReactions), and
// long-pressing a bubble (holding ~450ms, mouse or touch) pops the
// 4-emoji picker up right above it -- there's no persistent "+" button
// cluttering every message.
export default function MessageThreadView({
  messages,
  currentUserId,
  onSend,
  onReact,
  muted,
  onToggleMute,
  onClear,
  onDelete,
  emptyText = "No messages yet — say hello.",
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerForId, setPickerForId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomRef = useRef(null);
  const pressTimerRef = useRef(null);

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

  const startPress = (messageId) => {
    pressTimerRef.current = setTimeout(() => setPickerForId(messageId), LONG_PRESS_MS);
  };
  const cancelPress = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  };

  const pickEmoji = (messageId, emoji) => {
    onReact(messageId, emoji);
    setPickerForId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center px-5 pt-2 relative">
        <button
          onClick={onToggleMute}
          className="flex items-center gap-1.5 text-xs text-inkfaint"
          title={muted ? "Unmute notifications" : "Mute notifications"}
        >
          {muted ? <BellOff size={14} /> : <Bell size={14} />}
          {muted ? "Muted" : "Notifications on"}
        </button>
        {(onClear || onDelete) && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Chat options"
              className="text-inkfaint p-1"
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 bg-card border border-line rounded-lg shadow-lg py-1 w-40 z-20">
                  {onClear && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onClear();
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-inksoft"
                    >
                      Clear chat
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete();
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400"
                    >
                      Delete conversation
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {messages === null && <SkeletonList count={3} />}
        {messages?.length === 0 && <p className="text-sm text-inkfaint text-center mt-6">{emptyText}</p>}
        {messages?.map((m) => {
          const isMine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] ${isMine ? "items-end" : "items-start"} flex flex-col relative`}>
                {!isMine && <p className="text-xs text-inkfaint mb-0.5">{m.users?.display_name}</p>}
                <div className="relative">
                  <div
                    onPointerDown={() => startPress(m.id)}
                    onPointerUp={cancelPress}
                    onPointerLeave={cancelPress}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap select-none ${
                      isMine ? "bg-accent text-white rounded-br-sm" : "bg-card border border-line rounded-bl-sm"
                    }`}
                  >
                    {m.body}
                  </div>
                  <MessageReactions
                    reactions={m.reactions}
                    currentUserId={currentUserId}
                    alignRight={isMine}
                    onToggle={(emoji) => onReact(m.id, emoji)}
                  />
                  {pickerForId === m.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setPickerForId(null)} />
                      <div
                        className={`absolute bottom-full mb-1.5 bg-card border border-line rounded-full shadow-lg px-1.5 py-1 flex gap-1 z-20 ${
                          isMine ? "right-0" : "left-0"
                        }`}
                      >
                        {EMOJI_SET.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => pickEmoji(m.id, emoji)}
                            className="text-lg leading-none p-1 active:scale-90 transition-transform"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <p className="text-[0.625rem] text-inkfaint mt-2">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
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
