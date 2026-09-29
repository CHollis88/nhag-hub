import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";

// v71 #24 -- what permanently deleting this ministry would destroy, counted
// by the SERVER at the moment you ask (not guessed by the screen), so the
// warning says "12 members, 34 news posts, 8 events ..." and means it.
// Admin only.
const COUNTS = [
  ["members", "group_members", (q) => q.eq("status", "active")],
  ["pending_requests", "group_members", (q) => q.eq("status", "pending")],
  ["news_posts", "group_news"],
  ["events", "group_events"],
  ["prayer_requests", "group_prayer"],
  ["songs", "group_songs"],
  ["setlists", "group_setlists"],
  ["programs", "programs"],
  ["curriculum_files", "curriculum_materials"],
  ["chat_messages", "group_chat_messages"],
  ["conversations", "group_dm_threads"],
];

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });

  const { id } = await params;
  const supabase = supabaseServer();

  const { data: group, error: groupError } = await supabase.from("groups").select("id, name, archived_at").eq("id", id).maybeSingle();
  if (groupError) return NextResponse.json({ error: groupError.message }, { status: 500 });
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

  const results = await Promise.all(
    COUNTS.map(async ([key, table, refine]) => {
      let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("group_id", id);
      if (refine) q = refine(q);
      const { count, error } = await q;
      return [key, error ? null : count || 0];
    })
  );
  const counts = Object.fromEntries(results);

  return withNoStore({ group: { id: group.id, name: group.name, archived: Boolean(group.archived_at) }, counts });
}
