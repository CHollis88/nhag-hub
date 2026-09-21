import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember, isAnyGroupLeader } from "@/lib/groupAuth";
import { withPrivateCache } from "@/lib/cacheHeaders";

const VALID_TYPES = ["group_news", "global_news", "group_prayer"];
// Same fixed set as message_reactions (migration_028) plus a 5th for
// prayer/celebration content -- adding more later never needs a
// migration since this list lives in app code, not a DB constraint.
const ALLOWED_EMOJI = ["👍", "❤️", "🙏", "😂", "😢"];

// Checks whether this user is even allowed to SEE the post before
// letting them react to it -- a leader-only post or a leaders-audience
// global post shouldn't be reactable by someone who can't see it exists.
async function canReactTo(supabase, user, type, postId) {
  if (type === "group_news") {
    const { data: post } = await supabase
      .from("group_news")
      .select("group_id, kind")
      .eq("id", postId)
      .maybeSingle();
    if (!post) return null;
    const allowed = post.kind === "leader" ? await canManageGroup(user, post.group_id) : await isActiveGroupMember(user, post.group_id);
    return allowed ? post.group_id : null;
  }

  if (type === "global_news") {
    const { data: post } = await supabase
      .from("global_news")
      .select("audience")
      .eq("id", postId)
      .maybeSingle();
    if (!post) return null;
    if (post.audience === "leaders") {
      return (await isAnyGroupLeader(user)) ? true : null;
    }
    return true;
  }

  // group_prayer
  const { data: post } = await supabase
    .from("group_prayer")
    .select("group_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return null;
  return (await isActiveGroupMember(user, post.group_id)) ? post.group_id : null;
}

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { type, postId } = await params;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid post type." }, { status: 400 });
  }

  const supabase = supabaseServer();
  if (!(await canReactTo(supabase, user, type, postId))) {
    return NextResponse.json({ error: "You don't have access to that post." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("post_reactions")
    .select("emoji, user_id")
    .eq("post_type", type)
    .eq("post_id", postId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Grouped counts per emoji plus whether the current user reacted with
  // each, so the client never has to do this aggregation itself.
  const counts = {};
  for (const r of data) {
    if (!counts[r.emoji]) counts[r.emoji] = { emoji: r.emoji, count: 0, mine: false };
    counts[r.emoji].count += 1;
    if (r.user_id === user.id) counts[r.emoji].mine = true;
  }

  return withPrivateCache({ reactions: Object.values(counts) }, { maxAge: 30, staleWhileRevalidate: 120 });
}

// Toggles: reacting again with the same emoji removes it, matching the
// message_reactions behavior this table mirrors.
export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { type, postId } = await params;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid post type." }, { status: 400 });
  }

  const { emoji } = await req.json();
  if (!ALLOWED_EMOJI.includes(emoji)) {
    return NextResponse.json({ error: "That emoji isn't available for reactions." }, { status: 400 });
  }

  const supabase = supabaseServer();
  if (!(await canReactTo(supabase, user, type, postId))) {
    return NextResponse.json({ error: "You don't have access to that post." }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("post_reactions")
    .select("id")
    .eq("post_type", type)
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("post_reactions").delete().eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reacted: false });
  }

  const { error } = await supabase
    .from("post_reactions")
    .insert({ post_type: type, post_id: postId, user_id: user.id, emoji });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reacted: true });
}
