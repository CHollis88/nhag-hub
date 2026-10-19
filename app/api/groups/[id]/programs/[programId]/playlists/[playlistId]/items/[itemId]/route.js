import { NextResponse } from "next/server";
import { guardPlaylist } from "../../../guard";

export async function DELETE(req, { params }) {
  const p = await params;
  const g = await guardPlaylist(req, p, { needPlaylist: true });
  if (g.error) return g.error;
  const { supabase, playlist } = g;
  const { error } = await supabase
    .from("program_playlist_items")
    .delete()
    .eq("id", p.itemId)
    .eq("playlist_id", playlist.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
