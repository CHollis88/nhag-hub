"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ArrowLeft, MessageCirclePlus } from "lucide-react";
import { SkeletonList } from "./Skeleton";
import MessageThreadView from "./MessageThreadView";

// Direct Messages (feature key "direct_messages"). A regular member
// picks one or more of the group's leaders to start a private thread
// with; a leader or admin can additionally pick any active member (or
// another leader) -- per Cam's decision, leaders should be able to
// reach out to a member directly too, not just reply once a member
// messages them first. A new participant set is always a new thread
// rather than reusing/merging an existing one.
export default function DirectMessagesTab({ groupId, currentUserId, canManage, initialThreadId }) {
  const [threads, setThreads] = useState(null);
  const [openThreadId, setOpenThreadId] = useState(null);
  const [messages, setMessages] = useState(null);
  const [muted, setMuted] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);
  const pollRef = useRef(null);
  const deepLinkOpenedRef = useRef(false);

  const loadThreads = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/dm-threads`);
    const data = await res.json();
    if (res.ok) setThreads(data.threads);
  }, [groupId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Deep link from a clicked push notification (see page.js) -- open the
  // specific thread it was about, once, after the thread list itself has
  // loaded so the header shows the right participant names and the
  // correct mute state from the start.
  useEffect(() => {
    if (deepLinkOpenedRef.current || !initialThreadId || threads === null) return;
    deepLinkOpenedRef.current = true;
    openThread(initialThreadId);
  }, [threads, initialThreadId]);

  // A leader/admin can message anyone active in the group; a regular
  // member can only message this group's leaders (server-side, the
  // dm-threads POST route enforces this exact same split -- this is
  // just which names the picker offers, not the actual authority check).
  const loadRecipients = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/members`);
    const data = await res.json();
    if (res.ok) {
      const active = data.active || [];
      setRecipients(
        canManage
          ? active.filter((m) => m.user_id !== currentUserId)
          : active.filter((m) => m.role === "leader" && m.user_id !== currentUserId)
      );
    }
  }, [groupId, currentUserId, canManage]);

  const openPicker = () => {
    setSelectedRecipientIds([]);
    setPickerOpen(true);
    loadRecipients();
  };

  const startThread = async () => {
    if (!selectedRecipientIds.length) return;
    const res = await fetch(`/api/groups/${groupId}/dm-threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participant_ids: selectedRecipientIds }),
    });
    const data = await res.json();
    if (res.ok) {
      setPickerOpen(false);
      openThread(data.thread_id);
      loadThreads();
    }
  };

  const loadMessages = useCallback(
    async (threadId) => {
      const res = await fetch(`/api/groups/${groupId}/dm-threads/${threadId}/messages`);
      const data = await res.json();
      if (res.ok) setMessages(data.messages);
    },
    [groupId]
  );

  const openThread = (threadId) => {
    setOpenThreadId(threadId);
    setMessages(null);
    const thread = threads?.find((t) => t.id === threadId);
    setMuted(Boolean(thread?.muted));
    loadMessages(threadId);
    fetch(`/api/groups/${groupId}/dm-threads/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_read: true }),
    }).then(loadThreads);
  };

  // Light polling while a thread is open -- this app has no realtime
  // transport, so a short interval keeps a conversation feeling current
  // without needing one.
  useEffect(() => {
    if (!openThreadId) return;
    pollRef.current = setInterval(() => loadMessages(openThreadId), 4000);
    return () => clearInterval(pollRef.current);
  }, [openThreadId, loadMessages]);

  const send = async (body) => {
    await fetch(`/api/groups/${groupId}/dm-threads/${openThreadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    loadMessages(openThreadId);
  };

  const react = async (messageId, emoji) => {
    await fetch(`/api/messages/dm/${messageId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    loadMessages(openThreadId);
  };

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    await fetch(`/api/groups/${groupId}/dm-threads/${openThreadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ muted: next }),
    });
    loadThreads();
  };

  // Wipes the messages but keeps the conversation itself -- so it's
  // still there in your list, just empty, ready to use again.
  const clearChat = async () => {
    if (!confirm("Clear this conversation's messages? This can't be undone.")) return;
    await fetch(`/api/groups/${groupId}/dm-threads/${openThreadId}/messages`, { method: "DELETE" });
    loadMessages(openThreadId);
  };

  // Removes the conversation entirely -- for everyone in it, not just
  // you -- and returns to the thread list.
  const deleteConversation = async () => {
    if (!confirm("Delete this conversation for everyone in it? This can't be undone.")) return;
    await fetch(`/api/groups/${groupId}/dm-threads/${openThreadId}`, { method: "DELETE" });
    setOpenThreadId(null);
    loadThreads();
  };

  if (openThreadId) {
    const thread = threads?.find((t) => t.id === openThreadId);
    return (
      <div className="h-full min-h-0 flex flex-col">
        <div className="flex items-center gap-2 px-5 pt-4 pb-2 flex-shrink-0">
          <button onClick={() => setOpenThreadId(null)} className="text-inkfaint p-1 flex-shrink-0">
            <ArrowLeft size={18} />
          </button>
          <p className="font-serif text-lg text-ink truncate min-w-0 flex-1">
            {thread?.participant_names?.join(", ") || "Conversation"}
          </p>
        </div>
        <div className="flex-1 min-h-0">
          <MessageThreadView
            messages={messages}
            currentUserId={currentUserId}
            onSend={send}
            onReact={react}
            muted={muted}
            onToggleMute={toggleMute}
            onClear={clearChat}
            onDelete={deleteConversation}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 pb-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-2xl text-ink">Messages</h2>
        <button onClick={openPicker} className="sp-btn-primary text-sm py-2 px-3 flex items-center gap-1.5">
          <MessageCirclePlus size={16} /> New
        </button>
      </div>

      {threads === null && <SkeletonList count={3} />}
      {threads?.length === 0 && (
        <p className="text-sm text-inkfaint">
          {canManage
            ? 'No conversations yet. Tap "New" to message someone in this ministry.'
            : 'No conversations yet. Tap "New" to message this ministry\'s leaders.'}
        </p>
      )}
      <div className="space-y-2">
        {threads?.map((t) => (
          <button
            key={t.id}
            onClick={() => openThread(t.id)}
            className="sp-card w-full text-left flex items-center justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm text-ink truncate">{t.participant_names.join(", ") || "Conversation"}</p>
              {t.last_message && (
                <p className="text-xs text-inkfaint truncate">{t.last_message.body}</p>
              )}
            </div>
            {t.unread_count > 0 && (
              <span className="ml-2 text-xs bg-accent text-white rounded-full px-2 py-0.5 flex-shrink-0">
                {t.unread_count}
              </span>
            )}
          </button>
        ))}
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-[60]" onClick={() => setPickerOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-t-2xl w-full max-h-[70vh] overflow-y-auto p-6"
          >
            <div className="flex justify-between items-center mb-3 gap-2">
              <h3 className="font-serif text-lg text-ink m-0 min-w-0 truncate">
                {canManage ? "New message" : "Message a leader"}
              </h3>
              <button onClick={() => setPickerOpen(false)} className="text-2xl text-inkfaint leading-none flex-shrink-0">
                ×
              </button>
            </div>
            {recipients.length === 0 && (
              <p className="text-sm text-inkfaint">
                {canManage ? "No one else is active in this ministry yet." : "This ministry has no other leaders yet."}
              </p>
            )}
            <div className="space-y-1.5 mb-4">
              {recipients.map((r) => (
                <label key={r.user_id} className="flex items-center gap-2 text-sm text-inksoft">
                  <input
                    type="checkbox"
                    checked={selectedRecipientIds.includes(r.user_id)}
                    onChange={(e) =>
                      setSelectedRecipientIds((prev) =>
                        e.target.checked ? [...prev, r.user_id] : prev.filter((id) => id !== r.user_id)
                      )
                    }
                  />
                  {r.users?.display_name}
                  {canManage && r.role === "leader" && <span className="text-inkfaint text-xs">· Leader</span>}
                </label>
              ))}
            </div>
            <button
              onClick={startThread}
              disabled={!selectedRecipientIds.length}
              className="sp-btn-primary w-full disabled:opacity-50"
            >
              Start conversation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
