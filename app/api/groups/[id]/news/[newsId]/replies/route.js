import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isActiveGroupMember } from "@/lib/groupAuth";
import { notifyGroupMember } from "@/lib/push";

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, newsId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_news_replies")
    .select("id, body, created_at, users(display_name)")
    .eq("news_id", newsId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ replies: data });
}

// Any active member (not just leaders) can reply -- but only to a
// 'discuss' post, per the Young Adults app's original pattern:
// Announcement and Class posts are one-way, Discuss posts are open for
// conversation. Enforced here, not just hidden in the UI.
export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, newsId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data: post, error: postError } = await supabase
    .from("group_news")
    .select("kind, title, created_by")
    .eq("id", newsId)
    .maybeSingle();

  if (postError) return NextResponse.json({ error: postError.message }, { status: 500 });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (post.kind !== "discuss") {
    return NextResponse.json({ error: "Only Discuss posts can be replied to." }, { status: 403 });
  }

  const { body } = await req.json();
  if (!body?.trim()) {
    return NextResponse.json({ error: "A reply can't be empty." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("group_news_replies")
    .insert({ news_id: newsId, user_id: user.id, body: body.trim() })
    .select("id, body, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Only the post's own author needs to know their Discuss post got a
  // reply -- not the whole group, and not the author themselves if
  // they're replying to their own post. created_by can be null if that
  // author's account was later deleted (schema: `on delete set null`).
  if (post.created_by && post.created_by !== user.id) {
    notifyGroupMember(groupId, post.created_by, {
      title: "New reply to your post",
      body: post.title ? `On "${post.title}"` : "Tap to view.",
      url: "/",
    }).catch(() => {});
  }

  return NextResponse.json({ reply: data });
}
