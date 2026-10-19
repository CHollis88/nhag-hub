import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isActiveGroupMember, assertInGroup } from "@/lib/groupAuth";

// Shared by every playlist route: who is asking, are they in this ministry, does
// the program really belong to it -- and, when a playlist id is given, is it THEIR
// playlist in THIS program. Playlists are private, so even a leader or admin
// can't read or change someone else's.
// Returns { user, supabase, playlist } or { error: NextResponse }.
export async function guardPlaylist(req, params, { needPlaylist = false } = {}) {
  const user = await getCurrentUser(req);
  if (!user) return { error: NextResponse.json({ error: "You must be signed in." }, { status: 401 }) };

  const { id: groupId, programId, playlistId } = params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return { error: NextResponse.json({ error: "You're not a member of this group." }, { status: 403 }) };
  }
  if (!(await assertInGroup("programs", programId, groupId))) {
    return { error: NextResponse.json({ error: "Program not found." }, { status: 404 }) };
  }

  const supabase = supabaseServer();
  if (!needPlaylist) return { user, supabase, programId };

  const { data: playlist } = await supabase
    .from("program_playlists")
    .select("id, name, program_id, user_id")
    .eq("id", playlistId)
    .eq("program_id", programId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!playlist) return { error: NextResponse.json({ error: "Playlist not found." }, { status: 404 }) };
  return { user, supabase, programId, playlist };
}
