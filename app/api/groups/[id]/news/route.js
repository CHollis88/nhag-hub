import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";
import { notifyGroup } from "@/lib/push";
import { withPrivateCache } from "@/lib/cacheHeaders";

const VALID_KINDS = ["announcement", "class", "discuss"];

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
    .select("id, title, body, kind, pinned, created_at, users(display_name)")
    .eq("group_id", groupId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return withPrivateCache({ news: data });
}

// Leader (own group) or admin only -- per the permission matrix, Members
// cannot create News/Events, only reply to them (and only to 'discuss'
// posts specifically -- see the replies route). kind mirrors the Young
// Adults app's Announcement/Class/Discuss pattern, applied here via the
// same generic module every ministry shares.
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

  const { title, body, kind } = await req.json();
  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "title and body are required." }, { status: 400 });
  }
  const finalKind = kind && VALID_KINDS.includes(kind) ? kind : "announcement";

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_news")
    .insert({ group_id: groupId, title: title.trim(), body: body.trim(), kind: finalKind, created_by: user.id })
    .select("id, title, body, kind, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const kindLabel = finalKind === "class" ? "Class Notes" : finalKind === "discuss" ? "Discussion" : "Group News";
  notifyGroup(groupId, { title: kindLabel, body: title.trim(), url: "/" }).catch(() => {});

  return NextResponse.json({ news: data });
}
