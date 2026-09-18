import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";
import { withNoStore } from "@/lib/cacheHeaders";

// Deliberately its own table (program_songs, migration_025) rather than
// group_songs with an added program_id column -- Cam's explicit answer
// was that a program's song library is FULLY SEPARATE from its parent
// ministry's main Songs tab, not shared. Authorization is still scoped
// to the PARENT group (canManageGroup/isActiveGroupMember take groupId,
// not programId) since a program's leaders are the same people as its
// group's leaders -- there's no separate per-program membership.
export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("program_songs")
    .select("*")
    .eq("program_id", programId)
    .order("title", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return withNoStore({ songs: data });
}

export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can add songs." },
      { status: 403 }
    );
  }

  const body = await req.json();
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }

  const allowedFields = [
    "title", "composer", "times_sung", "first_date", "most_recent_date",
    "lyrics_url", "chords_url", "sheet_music_url",
    "soprano_url", "alto_url", "tenor_url", "bass_url", "full_mix_url", "notes",
  ];
  const insert = { program_id: programId };
  for (const field of allowedFields) {
    if (body[field] !== undefined && body[field] !== "") insert[field] = body[field];
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase.from("program_songs").insert(insert).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ song: data });
}
