import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";
import { notifyGroup } from "@/lib/push";

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_news")
    .select("id, title, body, created_at, users(display_name)")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ news: data });
}

// Leader (own group) or admin only -- per the permission matrix, Members
// cannot create News/Events, only reply to them.
export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can post News." },
      { status: 403 }
    );
  }

  const { title, body } = await req.json();
  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "title and body are required." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_news")
    .insert({ group_id: groupId, title: title.trim(), body: body.trim(), created_by: user.id })
    .select("id, title, body, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  notifyGroup(groupId, { title: "Group News", body: title.trim(), url: "/" }).catch(() => {});

  return NextResponse.json({ news: data });
}
