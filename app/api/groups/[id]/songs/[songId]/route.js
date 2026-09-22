import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";

const ALLOWED_FIELDS = [
  "title", "composer", "times_sung", "first_date", "most_recent_date",
  "lyrics_url", "chords_url", "sheet_music_url",
  "soprano_url", "alto_url", "tenor_url", "bass_url", "split_track_url", "demo_url", "notes",
];

export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, songId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can edit songs." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const updates = { updated_at: new Date().toISOString() };
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) updates[field] = body[field] === "" ? null : body[field];
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("group_songs")
    .update(updates)
    .eq("id", songId)
    .eq("group_id", groupId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Song not found." }, { status: 404 });
  return NextResponse.json({ song: data });
}

export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, songId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can delete songs." },
      { status: 403 }
    );
  }

  // Deleting a song cascades to remove it from any setlists it's in
  // (group_setlist_songs.song_id -> on delete cascade). That's a real
  // consequence worth the leader knowing about; the confirm dialog for
  // this lives client-side.
  const supabase = supabaseServer();
  const { error } = await supabase.from("group_songs").delete().eq("id", songId).eq("group_id", groupId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
