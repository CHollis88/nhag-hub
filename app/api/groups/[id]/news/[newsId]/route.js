import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";
import { notifyGroup, notifyGroupLeaders } from "@/lib/push";

export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, newsId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can edit News." },
      { status: 403 }
    );
  }

  const { title, body, pinned, status, notify } = await req.json();
  const updates = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title.trim();
  if (body !== undefined) updates.body = body.trim();
  if (pinned !== undefined) updates.pinned = Boolean(pinned);
  const shouldNotify = notify !== false;
  let publishing = false;
  if (status !== undefined) {
    if (!["draft", "published"].includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    updates.status = status;
  }

  const supabase = supabaseServer();

  // Check prior status before updating, so publishing a draft can
  // trigger the same notification a fresh post would have -- a draft
  // never notified when it was first saved.
  let draftKind;
  if (status === "published") {
    const { data: before } = await supabase.from("group_news").select("status, kind").eq("id", newsId).maybeSingle();
    publishing = before?.status === "draft";
    draftKind = before?.kind;
  }

  const { data, error } = await supabase
    .from("group_news")
    .update(updates)
    .eq("id", newsId)
    .eq("group_id", groupId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  if (publishing) {
    const kindLabel =
      draftKind === "class" ? "Class Notes" : draftKind === "discuss" ? "Discussion" : draftKind === "leader" ? "Leaders Only" : "Group News";
    if (shouldNotify) {
      if (draftKind === "leader") {
        notifyGroupLeaders(groupId, { title: kindLabel, body: data.title, url: `/?group=${groupId}&tab=news` }).catch(() => {});
      } else {
        notifyGroup(groupId, { title: kindLabel, body: data.title, url: `/?group=${groupId}&tab=news` }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ news: data });
}

export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, newsId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can delete News." },
      { status: 403 }
    );
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("group_news").delete().eq("id", newsId).eq("group_id", groupId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
