import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember, isAnyGroupLeader } from "@/lib/groupAuth";
import { withNoStore } from "@/lib/cacheHeaders";
import { reactorNames, nameFor } from "@/lib/reactors";

// Reactions for MANY posts in one request:
//   GET /api/reactions?type=group_news&ids=a,b,c
// A News or Prayer list used to ask once per post (20 posts = 20 requests
// every time the list loaded). Same visibility rules, per post, as the
// single-post route (app/api/posts/[type]/[postId]/reactions): a post you
// can't see is simply left out. Toggling a reaction still uses that route.
const VALID_TYPES = ["group_news", "global_news", "group_prayer"];
const MAX_IDS = 100;

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type");
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: "Invalid post type." }, { status: 400 });
  const ids = [...new Set((req.nextUrl.searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean))];
  if (ids.length === 0) return withNoStore({ reactions: {} });
  if (ids.length > MAX_IDS) return NextResponse.json({ error: "Too many posts at once." }, { status: 400 });

  const supabase = supabaseServer();

  // Which of these posts may this person see?
  const cols = type === "global_news" ? "id, audience" : type === "group_news" ? "id, group_id, kind" : "id, group_id";
  const { data: posts, error: postsError } = await supabase.from(type).select(cols).in("id", ids);
  if (postsError) return NextResponse.json({ error: postsError.message }, { status: 500 });

  const memberOf = new Map();
  const leaderOf = new Map();
  const isMember = async (g) => {
    if (!memberOf.has(g)) memberOf.set(g, await isActiveGroupMember(user, g));
    return memberOf.get(g);
  };
  const isLeader = async (g) => {
    if (!leaderOf.has(g)) leaderOf.set(g, await canManageGroup(user, g));
    return leaderOf.get(g);
  };
  let anyLeader = null;

  const allowed = [];
  for (const p of posts || []) {
    let ok;
    if (type === "global_news") {
      if (p.audience === "leaders") {
        if (anyLeader === null) anyLeader = await isAnyGroupLeader(user);
        ok = anyLeader;
      } else ok = true;
    } else if (type === "group_news" && p.kind === "leader") ok = await isLeader(p.group_id);
    else ok = await isMember(p.group_id);
    if (ok) allowed.push(p.id);
  }
  if (allowed.length === 0) return withNoStore({ reactions: {} });

  const { data, error } = await supabase
    .from("post_reactions")
    .select("post_id, emoji, user_id")
    .eq("post_type", type)
    .in("post_id", allowed);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const names = await reactorNames(supabase, data);
  const byPost = Object.fromEntries(allowed.map((id) => [id, {}]));
  for (const r of data || []) {
    const counts = byPost[r.post_id];
    if (!counts) continue;
    if (!counts[r.emoji]) counts[r.emoji] = { emoji: r.emoji, count: 0, mine: false, names: [] };
    counts[r.emoji].count += 1;
    counts[r.emoji].names.push(r.user_id === user.id ? "You" : nameFor(names, r.user_id));
    if (r.user_id === user.id) counts[r.emoji].mine = true;
  }
  const reactions = Object.fromEntries(Object.entries(byPost).map(([id, counts]) => [id, Object.values(counts)]));
  return withNoStore({ reactions });
}
