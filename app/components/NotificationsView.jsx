"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, BellOff } from "lucide-react";
import EmptyState from "./EmptyState";
import { SkeletonRowList } from "./Skeleton";
import Modal from "./Modal";
import { requestJson } from "@/lib/request";
import { useAction } from "./useAction";

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsView({ onClose, onNavigate }) {
  const [notifications, setNotifications] = useState(null);
  // v71 #44: 50 at a time. `hasMore` = older ones exist beyond what's shown.
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [loadFailed, setLoadFailed] = useState(false);
  const run = useAction();

  const load = useCallback(async () => {
    try {
      const data = await requestJson("/api/notifications");
      setNotifications(data.notifications);
      setHasMore(Boolean(data.has_more));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The page older than the oldest notification shown, added to the end.
  const loadOlder = async () => {
    const oldest = notifications?.[notifications.length - 1]?.created_at;
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    const { ok, data } = await run(() => requestJson(`/api/notifications?before=${encodeURIComponent(oldest)}`));
    setLoadingMore(false);
    if (!ok) return; // useAction showed the reason; the button stays for a retry
    setNotifications((prev) => {
      const have = new Set(prev.map((n) => n.id));
      return [...prev, ...data.notifications.filter((n) => !have.has(n.id))];
    });
    setHasMore(Boolean(data.has_more));
  };

  const markRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await requestJson(`/api/notifications/${id}`, { method: "PATCH" });
    } catch {
      // Best effort -- failing to mark read must never block navigating.
    }
  };

  const markAllRead = async () => {
    const before = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    const { ok } = await run(() => requestJson("/api/notifications/mark-all-read", { method: "POST" }));
    if (!ok) setNotifications(before); // they're still unread -- show that
  };

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  // Tap: mark read (if unread) -> close -> go where the notification points
  // (v71 #4). Same in-app routing a push click uses, no page reload.
  const openNotification = async (n) => {
    // Wait for the read-mark so the bell badge refresh that runs on close
    // sees the new count (the request is tiny; markRead never throws).
    if (!n.read) await markRead(n.id);
    onClose();
    if (n.url) onNavigate?.(n.url);
  };

  return (
    <Modal title="Notifications" onClose={onClose} z={60} maxHeight="85vh">
      {unreadCount > 0 && (
        <button onClick={markAllRead} className="text-xs text-accent underline mb-4 block">
          Mark all as read
        </button>
      )}

      {notifications === null && loadFailed && <EmptyState kind="error" text="Couldn't load notifications." onRetry={load} />}
      {notifications === null && !loadFailed && <SkeletonRowList count={5} />}
      {notifications?.length === 0 && (
        <EmptyState icon={BellOff} text="Nothing here yet." />
      )}

      <div className="space-y-2">
        {notifications?.map((n) => (
          <button
            key={n.id}
            onClick={() => openNotification(n)}
            className={`w-full text-left sp-card ${n.read ? "" : "border-accent/40"}`}
          >
            <div className="flex items-start gap-2">
              {!n.read && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1.5" />}
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${n.read ? "text-inksoft" : "text-ink font-medium"}`}>{n.title}</p>
                {n.body && <p className="text-xs text-inkfaint mt-0.5">{n.body}</p>}
                <p className="text-[0.625rem] text-inkfaint mt-1">{timeAgo(n.created_at)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {hasMore && (
        <div className="text-center mt-3">
          <button
            type="button"
            onClick={loadOlder}
            disabled={loadingMore}
            aria-busy={loadingMore || undefined}
            className="sp-btn-secondary text-sm px-4 min-h-[44px] disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load older notifications"}
          </button>
        </div>
      )}
    </Modal>
  );
}
