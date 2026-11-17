"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import EmptyState from "./EmptyState";
import { SkeletonRowList } from "./Skeleton";
import { useAction } from "./useAction";
import { requestJson } from "@/lib/request";
import { useResource } from "@/lib/useResource";
import { ADMIN_ATTENTION } from "@/lib/adminData";

// v71 #22 -- the Admin Toolbox's ONE "Needs attention" list.
//
// Everything waiting on an admin, in one place: people asking to join a
// ministry, ministries asking to push a post church-wide, and unresolved
// feedback. Each item carries its own primary action right on it, and
// finishing one keeps you in the list -- the item just goes away and the
// count drops. Deliberately lean (no statuses, assignment, bulk actions).
//
// The list is fetched once when the Toolbox opens. After an action the
// item is removed locally (only if the server accepted it -- a failure
// leaves it there, with the reason in a toast) and `onChanged` lets the
// app refresh the badge on the Toolbox icon.

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function AdminNeedsAttention({ onChanged }) {
  // Through the shared screen cache (the Toolbox's pending badges read the
  // same entry): reopening the Toolbox shows this at once, and it's re-checked
  // behind the scenes once it's ~15 s old.
  const { data: cached, error: loadError, refresh, setData } = useResource(ADMIN_ATTENTION.key, ADMIN_ATTENTION.fetcher, {
    staleMs: ADMIN_ATTENTION.staleMs,
  });
  const state = cached || { items: null, counts: null };
  const setState = (fn) => setData((prev) => (typeof fn === "function" ? fn(prev || { items: [], counts: {} }) : fn));
  const failed = Boolean(loadError) && !cached;
  const [busyId, setBusyId] = useState(null);
  const busyRef = useRef(false);
  const run = useAction();

  const load = () => refresh();

  // Runs one item's action; on success removes it from the list.
  const act = async (item, request, success) => {
    if (busyRef.current) return; // one at a time -- no double taps
    busyRef.current = true;
    setBusyId(item.id);
    const { ok } = await run(request, { success });
    busyRef.current = false;
    setBusyId(null);
    if (!ok) return;
    setState((prev) => {
      const items = prev.items.filter((i) => !(i.kind === item.kind && i.id === item.id));
      const counts = { ...prev.counts };
      const key = { join: "joins", promotion: "promotions", feedback: "feedback" }[item.kind];
      counts[key] = Math.max(0, (counts[key] || 0) - 1);
      counts.total = Math.max(0, (counts.total || 0) - 1);
      // Keep the Toolbox's "N pending" badge on that ministry in step.
      const pending_by_group = { ...(prev.pending_by_group || {}) };
      if (item.kind === "join" && pending_by_group[item.group_id]) pending_by_group[item.group_id] -= 1;
      return { ...prev, items, counts, pending_by_group };
    });
    onChanged?.();
  };

  const { items, counts } = state;

  return (
    <section aria-labelledby="needs-attention-heading" className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <h3 id="needs-attention-heading" className="text-xs uppercase tracking-wide text-inkfaint m-0">
          Needs attention
        </h3>
        {counts && counts.total > 0 && (
          <span className="text-xs bg-accent text-white rounded-full px-2 py-0.5" aria-label={`${counts.total} waiting`}>
            {counts.total}
          </span>
        )}
      </div>

      {items === null && failed && <EmptyState kind="error" text="Couldn't load what needs attention." onRetry={load} />}
      {items === null && !failed && <SkeletonRowList count={2} />}
      {items?.length === 0 && (
        <p className="sp-card text-sm text-inkfaint flex items-center gap-2">
          <CheckCircle2 size={16} className="text-sage flex-shrink-0" aria-hidden="true" /> All caught up — nothing is waiting on you.
        </p>
      )}

      <ul className="space-y-2 list-none p-0 m-0">
        {items?.map((item) => {
          const busy = busyId === item.id;
          const key = `${item.kind}-${item.id}`;

          if (item.kind === "join") {
            return (
              <li key={key} className="sp-card">
                <p className="text-sm text-ink m-0">
                  <strong>{item.person}</strong>
                  {item.username && <span className="text-inkfaint"> (@{item.username})</span>} wants to join{" "}
                  <strong>{item.group_name}</strong>
                </p>
                <p className="text-xs text-inkfaint mt-0.5 mb-2">Join request · {timeAgo(item.created_at)}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      act(item, () => requestJson(`/api/groups/${item.group_id}/members/${item.id}/approve`, { method: "POST" }), `${item.person} approved`)
                    }
                    disabled={busy}
                    className="sp-btn-sage text-xs py-1.5 px-3 disabled:opacity-60"
                    aria-label={`Approve ${item.person} joining ${item.group_name}`}
                  >
                    {busy ? "…" : "Approve"}
                  </button>
                  <button
                    onClick={() =>
                      act(item, () => requestJson(`/api/groups/${item.group_id}/members/${item.id}`, { method: "DELETE" }), "Request rejected")
                    }
                    disabled={busy}
                    className="sp-btn-secondary text-xs py-1.5 px-3 disabled:opacity-60"
                    aria-label={`Reject ${item.person} joining ${item.group_name}`}
                  >
                    Reject
                  </button>
                </div>
              </li>
            );
          }

          if (item.kind === "promotion") {
            return (
              <li key={key} className="sp-card">
                <p className="text-xs text-inkfaint m-0 mb-1">
                  <strong className="text-ink">{item.group_name}</strong> wants to post this church-wide · requested by {item.requested_by} · {timeAgo(item.created_at)}
                </p>
                <p className="font-medium text-ink text-sm m-0">{item.title}</p>
                {item.body && <p className="text-sm text-inksoft mt-0.5 mb-2 whitespace-pre-wrap">{item.body}</p>}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() =>
                      act(item, () => requestJson(`/api/admin/promotion-requests/${item.id}/approve`, { method: "POST" }), "Approved — posted church-wide")
                    }
                    disabled={busy}
                    className="sp-btn-sage text-xs py-1.5 px-3 disabled:opacity-60"
                    aria-label={`Approve "${item.title}" for church-wide`}
                  >
                    {busy ? "…" : "Approve — post church-wide"}
                  </button>
                  <button
                    onClick={() =>
                      act(item, () => requestJson(`/api/admin/promotion-requests/${item.id}/reject`, { method: "POST" }), "Request rejected")
                    }
                    disabled={busy}
                    className="sp-btn-secondary text-xs py-1.5 px-3 disabled:opacity-60"
                    aria-label={`Reject "${item.title}"`}
                  >
                    Reject
                  </button>
                </div>
              </li>
            );
          }

          return (
            <li key={key} className="sp-card">
              <p className="text-sm text-ink whitespace-pre-wrap m-0 mb-1.5">{item.message}</p>
              <p className="text-xs text-inkfaint m-0 mb-2">
                Feedback · {item.from || "Anonymous"}
                {item.group_name && ` · ${item.group_name}`} · {timeAgo(item.created_at)}
              </p>
              <button
                onClick={() =>
                  act(item, () => requestJson(`/api/admin/feedback/${item.id}`, { method: "PATCH", body: { resolved: true } }), "Marked resolved")
                }
                disabled={busy}
                className="sp-btn-secondary text-xs py-1.5 px-3 disabled:opacity-60"
                aria-label="Mark this feedback resolved"
              >
                {busy ? "…" : "Mark resolved"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
