import { NextResponse } from "next/server";
import { withNoStore } from "@/lib/cacheHeaders";
import { MAX_PLAYLISTS_PER_PROGRAM, MAX_PLAYLIST_NAME } from "@/lib/playlistTracks";
import { guardPlaylist } from "./guard";

// My playlists in this program, each with its entries in order. Entries carry
// only ids and the track slot; the Playlist tab already has the program's songs
// and joins them itself, so a song edit shows up without touching playlists.
export async function GET(req, { params }) {
  const g = await guardPlaylist(req, await params);
  if (g.error) return g.error;
  const { user, supabase, programId } = g;

  const { data: lists, error } = await supabase
    .from("program_playlists")
    .select("id, name, created_at")
    .eq("program_id", programId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (lists || []).map((l) => l.id);
  const { data: items, error: itemsError } = ids.length
    ? await supabase
        .from("program_playlist_items")
        .select("id, playlist_id, program_song_id, track_key, position")
        .in("playlist_id", ids)
        .order("position", { ascending: true })
    : { data: [], error: null };
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  const byList = {};
  for (const it of items || []) (byList[it.playlist_id] ||= []).push(it);
  return withNoStore({ playlists: (lists || []).map((l) => ({ ...l, items: byList[l.id] || [] })) });
}

export async function POST(req, { params }) {
  const g = await guardPlaylist(req, await params);
  if (g.error) return g.error;
  const { user, supabase, programId } = g;

  const { name } = await req.json().catch(() => ({}));
  const clean = (name || "").trim().slice(0, MAX_PLAYLIST_NAME);
  if (!clean) return NextResponse.json({ error: "Give the playlist a name." }, { status: 400 });

  const { count } = await supabase
    .from("program_playlists")
    .select("id", { count: "exact", head: true })
    .eq("program_id", programId)
    .eq("user_id", user.id);
  if ((count || 0) >= MAX_PLAYLISTS_PER_PROGRAM) {
    return NextResponse.json({ error: `You can have up to ${MAX_PLAYLISTS_PER_PROGRAM} playlists in one program.` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("program_playlists")
    .insert({ program_id: programId, user_id: user.id, name: clean })
    .select("id, name, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ playlist: { ...data, items: [] } });
}
