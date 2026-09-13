import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isActiveGroupMember } from "@/lib/groupAuth";

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, newsId } = params;
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

// Any active member (not just leaders) can reply -- per the project's
// decision, Members can reply to News/Events discussions even though they
// can't create the posts themselves.
export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, newsId } = params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const { body } = await req.json();
  if (!body?.trim()) {
    return NextResponse.json({ error: "A reply can't be empty." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_news_replies")
    .insert({ news_id: newsId, user_id: user.id, body: body.trim() })
    .select("id, body, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reply: data });
}
