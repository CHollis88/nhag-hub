import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, isActiveGroupMember } from "@/lib/groupAuth";
import { notifyGroup } from "@/lib/push";
import { withNoStore } from "@/lib/cacheHeaders";

const VALID_SERVICES = ["AM", "PM", "CP"];

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { data: setlists, error } = await supabase
    .from("program_setlists")
    .select("id, service_date, service")
    .eq("program_id", programId)
    .order("service_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const withSongs = await Promise.all(
    setlists.map(async (s) => {
      const { data: songs } = await supabase
        .from("program_setlist_songs")
        .select("id, note, position, program_songs(id, title, composer)")
        .eq("setlist_id", s.id)
        .order("position", { ascending: true });
      return { ...s, songs: songs || [] };
    })
  );

  return withNoStore({ setlists: withSongs });
}

export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can create setlists." },
      { status: 403 }
    );
  }

  const { service_date, service } = await req.json();
  if (!service_date || !VALID_SERVICES.includes(service)) {
    return NextResponse.json(
      { error: `service_date is required and service must be one of: ${VALID_SERVICES.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("program_setlists")
    .insert({ program_id: programId, service_date, service })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Include the program's own name in the notification -- a bare "New
  // Setlist" would be ambiguous between the ministry's main setlists and
  // one belonging to a specific program.
  const { data: program } = await supabase.from("programs").select("name").eq("id", programId).maybeSingle();
  notifyGroup(groupId, {
    title: program?.name ? `New ${program.name} Setlist` : "New Program Setlist",
    body: `${service} — ${service_date}`,
    url: `/?group=${groupId}&tab=programs`,
  }).catch(() => {});

  return NextResponse.json({ setlist: { ...data, songs: [] } });
}
