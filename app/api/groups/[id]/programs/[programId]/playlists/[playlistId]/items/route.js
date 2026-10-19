import { NextResponse } from "next/server";
import { PLAYLIST_TRACK_KEYS, MAX_ITEMS_PER_PLAYLIST } from "@/lib/playlistTracks";
import { guardPlaylist } from "../../guard";

// Add entries to the END of a playlist: { entries: [{ program_song_id, track_key }] }.
// Every song must belong to THIS program, and the key must be an audio track slot.
export async function POST(req, { params }) {
  const g = await guardPlaylist(req, await params, { needPlaylist: true });
  if (g.error) return g.error;
  const { supabase, programId, playlist } = g;

  const { entries } = await req.json().catch(() => ({}));
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "Pick at least one track to add." }, { status: 400 });
  }
  for (const e of entries) {
    if (!e || typeof e.program_song_id !== "string" || !PLAYLIST_TRACK_KEYS.includes(e.track_key)) {
      return NextResponse.json({ error: "One of those tracks isn't valid." }, { status: 400 });
    }
  }

  const songIds = [...new Set(entries.map((e) => e.program_song_id))];
  const { data: songs } = await supabase.from("program_songs").select("id").eq("program_id", programId).in("id", songIds);
  if ((songs || []).length !== songIds.length) {
    return NextResponse.json({ error: "One of those songs isn't in this program." }, { status: 400 });
  }

  const { data: last } = await supabase
    .from("program_playlist_items")
    .select("position")
    .eq("playlist_id", playlist.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { count } = await supabase
    .from("program_playlist_items")
    .select("id", { count: "exact", head: true })
    .eq("playlist_id", playlist.id);
  if ((count || 0) + entries.length > MAX_ITEMS_PER_PLAYLIST) {
    return NextResponse.json({ error: `A playlist can hold up to ${MAX_ITEMS_PER_PLAYLIST} tracks.` }, { status: 400 });
  }

  const start = (last?.position ?? -1) + 1;
  const rows = entries.map((e, i) => ({
    playlist_id: playlist.id,
    program_song_id: e.program_song_id,
    track_key: e.track_key,
    position: start + i,
  }));
  const { data, error } = await supabase
    .from("program_playlist_items")
    .insert(rows)
    .select("id, playlist_id, program_song_id, track_key, position");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

// Reorder: { order: [itemId, ...] } -- every entry of the playlist, in the new
// order. Rejected unless it is exactly the playlist's current set of entries.
export async function PUT(req, { params }) {
  const g = await guardPlaylist(req, await params, { needPlaylist: true });
  if (g.error) return g.error;
  const { supabase, playlist } = g;

  const { order } = await req.json().catch(() => ({}));
  const { data: current } = await supabase.from("program_playlist_items").select("id").eq("playlist_id", playlist.id);
  const have = new Set((current || []).map((r) => r.id));
  if (!Array.isArray(order) || order.length !== have.size || new Set(order).size !== order.length || !order.every((id) => have.has(id))) {
    return NextResponse.json({ error: "That playlist changed. Reload and try again." }, { status: 409 });
  }

  for (let i = 0; i < order.length; i++) {
    const { error } = await supabase.from("program_playlist_items").update({ position: i }).eq("id", order[i]).eq("playlist_id", playlist.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
