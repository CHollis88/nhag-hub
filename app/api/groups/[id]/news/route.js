import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";
import { notifyGroup, notifyGroupLeaders } from "@/lib/push";
import { withNoStore } from "@/lib/cacheHeaders";

const VALID_KINDS = ["announcement", "class", "discuss", "leader"];

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  // ?drafts=1 is the leader-only "Drafts" tab -- regular members never
  // see unpublished posts, same visibility principle as 'leader' kind.
  const wantDrafts = req.nextUrl.searchParams.get("drafts") === "1";
  if (wantDrafts && !(await canManageGroup(user, groupId))) {
    return NextResponse.json({ error: "Only this group's leaders or a Church Admin can view drafts." }, { status: 403 });
  }

  const supabase = supabaseServer();
  let query = supabase
    .from("group_news")
    .select("id, title, body, kind, pinned, status, created_at, users(display_name)")
    .eq("group_id", groupId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  query = wantDrafts ? query.eq("status", "draft") : query.eq("status", "published");
  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 'leader' posts are filtered out here (application layer, same
  // pattern as 'discuss' reply permission) for anyone who isn't a
  // leader/admin of THIS group -- a member should never even see that a
  // leader-only post exists, not just be blocked from opening it.
  const canSeeLeaderPosts = await canManageGroup(user, groupId);
  const visible = canSeeLeaderPosts ? data : data.filter((n) => n.kind !== "leader");

  return withNoStore({ news: visible });
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

  const { title, body, kind, status } = await req.json();
  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "title and body are required." }, { status: 400 });
  }
  const finalKind = kind && VALID_KINDS.includes(kind) ? kind : "announcement";
  const finalStatus = status === "draft" ? "draft" : "published";

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_news")
    .insert({ group_id: groupId, title: title.trim(), body: body.trim(), kind: finalKind, status: finalStatus, created_by: user.id })
    .select("id, title, body, kind, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // A draft never notifies -- there's nothing to announce until it's
  // actually published.
  if (finalStatus === "draft") {
    return NextResponse.json({ news: data });
  }

  const kindLabel =
    finalKind === "class" ? "Class Notes" : finalKind === "discuss" ? "Discussion" : finalKind === "leader" ? "Leaders Only" : "Group News";
  // A 'leader' post notifies only this group's own leaders/admins, not
  // the whole membership -- same reasoning as everything else in this
  // kind system being visibility-scoped at read time; the notification
  // should match who's actually allowed to see the content.
  if (finalKind === "leader") {
    notifyGroupLeaders(groupId, { title: kindLabel, body: title.trim(), url: `/?group=${groupId}&tab=news` }).catch(() => {});
  } else {
    notifyGroup(groupId, { title: kindLabel, body: title.trim(), url: `/?group=${groupId}&tab=news` }).catch(() => {});
  }

  return NextResponse.json({ news: data });
}
