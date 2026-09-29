import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, assertInGroup } from "@/lib/groupAuth";

export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId, setlistId, setlistSongId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can edit setlists." },
      { status: 403 }
    );
  }

  // v71 #2: the program must belong to THIS group -- otherwise a leader of
  // ministry A could act on ministry B's program by pairing A's group ID
  // with B's program ID.
  if (!(await assertInGroup("programs", programId, groupId))) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }
  if (
    !(await assertInGroup("program_setlists", setlistId, programId, "program_id")) ||
    !(await assertInGroup("program_setlist_songs", setlistSongId, setlistId, "setlist_id"))
  ) {
    return NextResponse.json({ error: "Setlist entry not found." }, { status: 404 });
  }

  const { note, position } = await req.json();
  const updates = {};
  if (note !== undefined) updates.note = note || null;
  if (position !== undefined) updates.position = position;

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("program_setlist_songs")
    .update(updates)
    .eq("id", setlistSongId)
    .select("id, note, position, program_songs(id, title, composer, lyrics_url, chords_url, sheet_music_url, soprano_url, alto_url, tenor_url, bass_url, split_track_url, demo_url)")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Setlist entry not found." }, { status: 404 });
  return NextResponse.json({ setlistSong: data });
}

export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId, setlistId, setlistSongId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can edit setlists." },
      { status: 403 }
    );
  }

  // v71 #2: the program must belong to THIS group -- otherwise a leader of
  // ministry A could act on ministry B's program by pairing A's group ID
  // with B's program ID.
  if (!(await assertInGroup("programs", programId, groupId))) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }
  if (
    !(await assertInGroup("program_setlists", setlistId, programId, "program_id")) ||
    !(await assertInGroup("program_setlist_songs", setlistSongId, setlistId, "setlist_id"))
  ) {
    return NextResponse.json({ error: "Setlist entry not found." }, { status: 404 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("program_setlist_songs").delete().eq("id", setlistSongId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
