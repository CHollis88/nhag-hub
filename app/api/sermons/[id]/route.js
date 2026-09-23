import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyGlobal } from "@/lib/push";

export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { id } = await params;
  const { title, synopsis, speaker, link_url, sermon_date, series_id, series_order, status, notify } = await req.json();
  const shouldNotify = notify !== false;

  const updates = { updated_at: new Date().toISOString() };
  if (title !== undefined) {
    if (!title.trim()) return NextResponse.json({ error: "title cannot be empty." }, { status: 400 });
    updates.title = title.trim();
  }
  if (synopsis !== undefined) {
    if (!synopsis.trim()) return NextResponse.json({ error: "synopsis cannot be empty." }, { status: 400 });
    updates.synopsis = synopsis.trim();
  }
  if (speaker !== undefined) updates.speaker = speaker?.trim() || null;
  if (link_url !== undefined) updates.link_url = link_url?.trim() || null;
  if (sermon_date !== undefined) updates.sermon_date = sermon_date || null;
  // Explicit null clears the series (moves the sermon back to
  // ungrouped) -- same "undefined means don't touch it" convention as
  // every other PATCH route in the app.
  if (series_id !== undefined) updates.series_id = series_id || null;
  if (series_order !== undefined) updates.series_order = Number.isInteger(series_order) ? series_order : null;
  if (status !== undefined) {
    if (!["draft", "published"].includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    updates.status = status;
  }

  const supabase = supabaseServer();

  // Check prior status before updating, so publishing a draft triggers
  // the same notification a fresh sermon post would have -- a draft
  // never notified when it was first saved.
  let publishing = false;
  if (status === "published") {
    const { data: before } = await supabase.from("sermons").select("status").eq("id", id).maybeSingle();
    publishing = before?.status === "draft";
  }

  const { data, error } = await supabase
    .from("sermons")
    .update(updates)
    .eq("id", id)
    .select("id, title, synopsis, speaker, link_url, sermon_date, series_id, series_order, status, created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Sermon not found." }, { status: 404 });

  if (publishing && shouldNotify) {
    notifyGlobal({
      title: "New Sermon",
      body: data.speaker ? `${data.title} — ${data.speaker}` : data.title,
      url: "/?tab=sermons",
    }).catch(() => {});
  }

  return NextResponse.json({ sermon: data });
}

export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = supabaseServer();
  const { error } = await supabase.from("sermons").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
