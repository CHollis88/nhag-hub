"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { ArrowLeft, MessageCirclePlus } from "lucide-react";
import { SkeletonList } from "./Skeleton";
import MessageThreadView from "./MessageThreadView";
import Modal from "./Modal";
import EmptyState from "./EmptyState";
import { useConfirm } from "./ConfirmDialog";
import { useAction } from "./useAction";
import { requestJson } from "@/lib/request";
import { mergeLatest, prependOlder } from "@/lib/messagePaging";
import { useAdaptivePolling, messagesSignature } from "@/lib/useAdaptivePolling";

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
  const [hasEarlier, setHasEarlier] = useState(false); // v71 #44
  const [muted, setMuted] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);
  const deepLinkOpenedRef = useRef(false);

  const [threadsFailed, setThreadsFailed] = useState(false);
  const confirm = useConfirm();
  const run = useAction();

  const loadThreads = useCallback(async () => {
    try {
      const data = await requestJson(`/api/groups/${groupId}/dm-threads`);
      setThreads(data.threads);
      setThreadsFailed(false);
    } catch {
      setThreadsFailed(true);
    }
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
    const { ok, data } = await run(() => requestJson(`/api/groups/${groupId}/members`));
    if (ok) {
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
    // The picker stays open (selection intact) if this fails.
    const { ok, data } = await run(() =>
      requestJson(`/api/groups/${groupId}/dm-threads`, { method: "POST", body: { participant_ids: selectedRecipientIds } })
    );
    if (ok) {
      setPickerOpen(false);
      openThread(data.thread_id);
      loadThreads();
    }
  };

  const loadMessages = useCallback(
    async (threadId) => {
      // Polled every 10-30 s: a failed poll must stay quiet (no toast every
      // few seconds while offline) -- it just tries again next time.
      try {
        const data = await requestJson(`/api/groups/${groupId}/dm-threads/${threadId}/messages`);
        // Merge onto what's loaded (v71 #44): a poll refreshes only the newest
        // page and must not throw away older messages already loaded.
        setMessages((current) => {
          if (current === null) setHasEarlier(Boolean(data.has_more));
          return mergeLatest(current, data.messages);
        });
        return messagesSignature(data.messages);
      } catch {
        return undefined;
      }
    },
    [groupId]
  );

  const openThread = (threadId) => {
    setOpenThreadId(threadId);
    setMessages(null);
    setHasEarlier(false);
    const thread = threads?.find((t) => t.id === threadId);
    setMuted(Boolean(thread?.muted));
    loadMessages(threadId);
    // Marking read is housekeeping -- never worth interrupting anyone over.
    requestJson(`/api/groups/${groupId}/dm-threads/${threadId}`, { method: "PATCH", body: { mark_read: true } })
      .then(loadThreads)
      .catch(() => {});
  };

  // Light polling while a thread is open -- this app has no realtime
  // transport. 10 s while messages are flowing, 30 s after 2 quiet
  // minutes, paused while the page is hidden (see lib/useAdaptivePolling).
  const pollOpenThread = useCallback(() => loadMessages(openThreadId), [loadMessages, openThreadId]);
  const nudgePolling = useAdaptivePolling(pollOpenThread, { enabled: Boolean(openThreadId), resetKey: openThreadId });

  // "Load earlier messages": the page older than the oldest one shown.
  const loadEarlier = async () => {
    const oldest = messages?.[0]?.created_at;
    if (!oldest) return;
    const { ok, data } = await run(() =>
      requestJson(`/api/groups/${groupId}/dm-threads/${openThreadId}/messages?before=${encodeURIComponent(oldest)}`)
    );
    if (!ok) return;
    setMessages((current) => prependOlder(current, data.messages));
    setHasEarlier(Boolean(data.has_more));
  };

  // Throws on failure -- MessageThreadView keeps the text in the box and
  // shows the reason next to the composer (v71 #14).
  const send = async (body) => {
    await requestJson(`/api/groups/${groupId}/dm-threads/${openThreadId}/messages`, { method: "POST", body: { body } });
    nudgePolling(); // refresh now and go back to the fast rate
  };

  const react = async (messageId, emoji) => {
    const { ok } = await run(() =>
      requestJson(`/api/messages/dm/${messageId}/reactions`, { method: "POST", body: { emoji } })
    );
    if (ok) loadMessages(openThreadId);
  };

  // Optimistic; put back (and say so) if the server refuses.
  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    const { ok } = await run(() =>
      requestJson(`/api/groups/${groupId}/dm-threads/${openThreadId}`, { method: "PATCH", body: { muted: next } })
    );
    if (!ok) setMuted(!next);
    else loadThreads();
  };

  // Wipes the messages but keeps the conversation itself -- so it's
  // still there in your list, just empty, ready to use again.
  const clearChat = async () => {
    const yes = await confirm({
      title: "Clear this conversation?",
      message: "All of its messages are removed for everyone in it. The conversation itself stays. This can't be undone.",
      confirmLabel: "Clear messages",
    });
    if (!yes) return;
    const { ok } = await run(
      () => requestJson(`/api/groups/${groupId}/dm-threads/${openThreadId}/messages`, { method: "DELETE" }),
      { success: "Messages cleared" }
    );
    if (ok) loadMessages(openThreadId);
  };

  // Removes the conversation entirely -- for everyone in it, not just
  // you -- and returns to the thread list.
  const deleteConversation = async () => {
    const yes = await confirm({
      title: "Delete this conversation?",
      message: "It is deleted for everyone in it, along with all of its messages. This can't be undone.",
      confirmLabel: "Delete conversation",
    });
    if (!yes) return;
    const { ok } = await run(
      () => requestJson(`/api/groups/${groupId}/dm-threads/${openThreadId}`, { method: "DELETE" }),
      { success: "Conversation deleted" }
    );
    if (ok) {
      setOpenThreadId(null);
      loadThreads();
    }
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
            hasEarlier={hasEarlier}
            onLoadEarlier={loadEarlier}
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

      {threads === null && threadsFailed && <EmptyState kind="error" text="Couldn't load conversations." onRetry={loadThreads} />}
      {threads === null && !threadsFailed && <SkeletonList count={3} />}
      {threads?.length === 0 && (
        <EmptyState
          icon={MessageCirclePlus}
          text={
            canManage
              ? "No conversations yet. Message someone in this ministry."
              : "No conversations yet. Message this ministry's leaders."
          }
          action={{ label: "New message", onClick: openPicker }}
        />
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
        <Modal
          title={canManage ? "New message" : "Message a leader"}
          headingClassName="font-serif text-lg text-ink m-0 min-w-0 truncate"
          onClose={() => setPickerOpen(false)}
          z={60}
          maxHeight="70vh"
        >
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
        </Modal>
      )}
    </div>
  );
}
