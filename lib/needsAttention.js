import { withColumnFallback } from "@/lib/compat";

// v71 #22 -- the Admin Toolbox's ONE "Needs attention" list: everything that
// is waiting on an admin, in one place, with one count.
//   * join requests waiting on approval (across every ministry)
//   * promotion requests (a ministry asking to push a post church-wide)
//   * unresolved feedback
// Deliberately lean: no statuses, assignment, or bulk actions -- each item
// has its own primary action inline, and finishing one just removes it.
//
// Ministries that are ARCHIVED don't contribute join requests: nobody can
// act on a request to join a ministry that's been put away.

const LIMIT = 50; // per kind; the count is always exact even when the list is capped

export async function listNeedsAttention(supabase) {
  const [joinsRes, promosRes, feedbackRes] = await Promise.all([
    withColumnFallback(
      () =>
        supabase
          .from("group_members")
          .select("id, group_id, created_at, users(display_name, username), groups!inner(name, archived_at)", { count: "exact" })
          .eq("status", "pending")
          .is("groups.archived_at", null)
          .order("created_at", { ascending: true })
          .limit(LIMIT),
      () =>
        supabase
          .from("group_members")
          .select("id, group_id, created_at, users(display_name, username), groups(name)", { count: "exact" })
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(LIMIT)
    ),
    supabase
      .from("group_promotion_requests")
      .select("id, group_id, source_type, source_id, created_at, groups(name), users!requested_by(display_name)", { count: "exact" })
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(LIMIT),
    supabase
      .from("feedback")
      .select("id, is_anonymous, message, created_at, users!created_by(display_name), groups(name)", { count: "exact" })
      .eq("resolved", false)
      .order("created_at", { ascending: true })
      .limit(LIMIT),
  ]);

  for (const res of [joinsRes, promosRes, feedbackRes]) if (res.error) throw new Error(res.error.message);

  // Attach what the promoted post says, so approving doesn't need a second
  // look elsewhere. One query for all of them.
  const promos = promosRes.data || [];
  const newsIds = promos.filter((p) => p.source_type === "news").map((p) => p.source_id);
  let newsById = {};
  if (newsIds.length) {
    const { data: news } = await supabase.from("group_news").select("id, title, body").in("id", newsIds);
    newsById = Object.fromEntries((news || []).map((n) => [n.id, n]));
  }

  const items = [
    ...(joinsRes.data || []).map((r) => ({
      kind: "join",
      id: r.id,
      group_id: r.group_id,
      group_name: r.groups?.name || "a ministry",
      person: r.users?.display_name || "Someone",
      username: r.users?.username || null,
      created_at: r.created_at,
    })),
    ...promos.map((r) => ({
      kind: "promotion",
      id: r.id,
      group_name: r.groups?.name || "a ministry",
      requested_by: r.users?.display_name || "A leader",
      title: newsById[r.source_id]?.title || "(post no longer exists)",
      body: newsById[r.source_id]?.body || "",
      created_at: r.created_at,
    })),
    ...(feedbackRes.data || []).map((f) => ({
      kind: "feedback",
      id: f.id,
      message: f.message,
      // Anonymous stays anonymous: the sender is never exposed here.
      from: f.is_anonymous ? null : f.users?.display_name || null,
      group_name: f.groups?.name || null,
      created_at: f.created_at,
    })),
  ].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))); // longest-waiting first

  const counts = {
    joins: joinsRes.count ?? (joinsRes.data || []).length,
    promotions: promosRes.count ?? promos.length,
    feedback: feedbackRes.count ?? (feedbackRes.data || []).length,
  };
  counts.total = counts.joins + counts.promotions + counts.feedback;

  return { items, counts };
}

// Just the number, for the badge on the Toolbox entry (three cheap count
// queries, no rows transferred).
export async function countNeedsAttention(supabase) {
  const head = { count: "exact", head: true };
  const [joins, promos, feedback] = await Promise.all([
    withColumnFallback(
      () => supabase.from("group_members").select("id, groups!inner(archived_at)", head).eq("status", "pending").is("groups.archived_at", null),
      () => supabase.from("group_members").select("id", head).eq("status", "pending")
    ),
    supabase.from("group_promotion_requests").select("id", head).eq("status", "pending"),
    supabase.from("feedback").select("id", head).eq("resolved", false),
  ]);
  return (joins.count || 0) + (promos.count || 0) + (feedback.count || 0);
}
