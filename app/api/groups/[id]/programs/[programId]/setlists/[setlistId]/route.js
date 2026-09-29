import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup, assertInGroup } from "@/lib/groupAuth";
import { rpcFailure } from "@/lib/rpc";

const VALID_SERVICES = ["AM", "PM", "CP"];

const SETLIST_ERRORS = {
  NH002: { status: 400, message: "Check the date, the service, and the songs, then try again." },
  NH003: { status: 400, message: "One of those songs isn't in this program's library." },
};

// v71 #9: header + complete song list saved in one database transaction
// (save_program_setlist, migration_034); a failure leaves the setlist
// exactly as it was.
export async function PUT(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId, setlistId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can edit setlists." },
      { status: 403 }
    );
  }
  if (!(await assertInGroup("programs", programId, groupId))) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  const { service_date, service, songs } = await req.json();
  if (!service_date || !VALID_SERVICES.includes(service) || !Array.isArray(songs)) {
    return NextResponse.json(
      { error: `service_date, songs, and a service of ${VALID_SERVICES.join("/")} are required.` },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase.rpc("save_program_setlist", {
    p_program_id: programId,
    p_setlist_id: setlistId,
    p_header: { service_date, service },
    p_songs: songs.map((s) => ({ song_id: s.song_id, note: s.note || null })),
  });
  if (error) return rpcFailure(error, SETLIST_ERRORS);
  if (data?.status === "not_found") return NextResponse.json({ error: "Setlist not found." }, { status: 404 });
  return NextResponse.json({ ok: true, setlist_id: data.setlist_id });
}

export async function PATCH(req, { params }) {
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

  const { service_date, service } = await req.json();
  const updates = { updated_at: new Date().toISOString() };
  if (service_date !== undefined) updates.service_date = service_date;
  if (service !== undefined) {
    if (!VALID_SERVICES.includes(service)) {
      return NextResponse.json({ error: `service must be one of: ${VALID_SERVICES.join(", ")}` }, { status: 400 });
    }
    updates.service = service;
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("program_setlists")
    .update(updates)
    .eq("id", setlistId)
    .eq("program_id", programId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Setlist not found." }, { status: 404 });
  return NextResponse.json({ setlist: data });
}

export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, programId, setlistId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can delete setlists." },
      { status: 403 }
    );
  }

  // v71 #2: the program must belong to THIS group -- otherwise a leader of
  // ministry A could act on ministry B's program by pairing A's group ID
  // with B's program ID.
  if (!(await assertInGroup("programs", programId, groupId))) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("program_setlists")
    .delete()
    .eq("id", setlistId)
    .eq("program_id", programId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
