import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, assertInGroup } from "@/lib/groupAuth";

export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId, setlistId } = await params;
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
  // ...the setlist must belong to that program.
  if (!(await assertInGroup("program_setlists", setlistId, programId, "program_id"))) {
    return NextResponse.json({ error: "Setlist not found." }, { status: 404 });
  }

  const { song_id, note } = await req.json();
  if (!song_id) {
    return NextResponse.json({ error: "song_id is required." }, { status: 400 });
  }

  // ...and so must the song being added -- otherwise the insert below
  // would attach (and the response would return the lyrics/chart links
  // of) another ministry's song.
  if (!(await assertInGroup("program_songs", song_id, programId, "program_id"))) {
    return NextResponse.json({ error: "Song not found." }, { status: 404 });
  }

  const supabase = supabaseServer();

  const { data: existing, error: existingError } = await supabase
    .from("program_setlist_songs")
    .select("position")
    .eq("setlist_id", setlistId)
    .order("position", { ascending: false })
    .limit(1);

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  const nextPosition = existing.length ? existing[0].position + 1 : 0;

  const { data, error } = await supabase
    .from("program_setlist_songs")
    .insert({ setlist_id: setlistId, song_id, note: note || null, position: nextPosition })
    .select("id, note, position, program_songs(id, title, composer, lyrics_url, chords_url, sheet_music_url, soprano_url, alto_url, tenor_url, bass_url, split_track_url, demo_url)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ setlistSong: data });
}
