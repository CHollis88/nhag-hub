import { NextResponse } from "next/server";
import { MAX_PLAYLIST_NAME } from "@/lib/playlistTracks";
import { guardPlaylist } from "../guard";

export async function PATCH(req, { params }) {
  const g = await guardPlaylist(req, await params, { needPlaylist: true });
  if (g.error) return g.error;
  const { supabase, playlist } = g;

  const { name } = await req.json().catch(() => ({}));
  const clean = (name || "").trim().slice(0, MAX_PLAYLIST_NAME);
  if (!clean) return NextResponse.json({ error: "Give the playlist a name." }, { status: 400 });

  const { error } = await supabase
    .from("program_playlists")
    .update({ name: clean, updated_at: new Date().toISOString() })
    .eq("id", playlist.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const g = await guardPlaylist(req, await params, { needPlaylist: true });
  if (g.error) return g.error;
  const { supabase, playlist } = g;
  const { error } = await supabase.from("program_playlists").delete().eq("id", playlist.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
