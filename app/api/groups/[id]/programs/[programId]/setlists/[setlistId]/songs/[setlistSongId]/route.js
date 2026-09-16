import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";

export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, setlistSongId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can edit setlists." },
      { status: 403 }
    );
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
    .select("id, note, position, program_songs(id, title, composer)")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Setlist entry not found." }, { status: 404 });
  return NextResponse.json({ setlistSong: data });
}

export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, setlistSongId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can edit setlists." },
      { status: 403 }
    );
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("program_setlist_songs").delete().eq("id", setlistSongId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
