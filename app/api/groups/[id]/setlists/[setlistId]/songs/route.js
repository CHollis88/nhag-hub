import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";

export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, setlistId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can edit setlists." },
      { status: 403 }
    );
  }

  const { song_id, note } = await req.json();
  if (!song_id) {
    return NextResponse.json({ error: "song_id is required." }, { status: 400 });
  }

  const supabase = supabaseServer();

  // New songs go to the end of the list -- position = current max + 1.
  const { data: existing, error: existingError } = await supabase
    .from("group_setlist_songs")
    .select("position")
    .eq("setlist_id", setlistId)
    .order("position", { ascending: false })
    .limit(1);

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  const nextPosition = existing.length ? existing[0].position + 1 : 0;

  const { data, error } = await supabase
    .from("group_setlist_songs")
    .insert({ setlist_id: setlistId, song_id, note: note || null, position: nextPosition })
    .select("id, note, position, group_songs(id, title, composer)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ setlistSong: data });
}
