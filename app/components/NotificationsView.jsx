"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, BellOff } from "lucide-react";
import EmptyState from "./EmptyState";
import { SkeletonRowList } from "./Skeleton";

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

export default function NotificationsView({ onClose }) {
  const [notifications, setNotifications] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    if (res.ok) setNotifications(data.notifications);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
  };

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-[60]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-t-2xl w-full max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex justify-between items-center mb-2 gap-2">
          <h2 className="font-serif text-xl text-ink m-0 min-w-0 truncate">Notifications</h2>
          <button onClick={onClose} className="text-2xl text-inkfaint leading-none flex-shrink-0">×</button>
        </div>

        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs text-accent underline mb-4 block">
            Mark all as read
          </button>
        )}

        {notifications === null && <SkeletonRowList count={5} />}
        {notifications?.length === 0 && (
          <EmptyState icon={BellOff} text="Nothing here yet." />
        )}

        <div className="space-y-2">
          {notifications?.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.read && markRead(n.id)}
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
      </div>
    </div>
  );
}
