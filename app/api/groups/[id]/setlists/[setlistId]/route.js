import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";
import { rpcFailure } from "@/lib/rpc";

const VALID_SERVICES = ["AM", "PM", "CP"];

const SETLIST_ERRORS = {
  NH002: { status: 400, message: "Check the date, the service, and the songs, then try again." },
  NH003: { status: 400, message: "One of those songs isn't in this ministry's library." },
};

// v71 #9: saves the header AND the complete song list in one database
// transaction. Any failure leaves the setlist exactly as it was -- the old
// client flow (update header, delete every song, re-add every song) could
// leave it half-empty.
export async function PUT(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, setlistId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can edit setlists." },
      { status: 403 }
    );
  }

  const { service_date, service, songs } = await req.json();
  if (!service_date || !VALID_SERVICES.includes(service) || !Array.isArray(songs)) {
    return NextResponse.json(
      { error: `service_date, songs, and a service of ${VALID_SERVICES.join("/")} are required.` },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase.rpc("save_setlist", {
    p_group_id: groupId,
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

  const { id: groupId, setlistId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can edit setlists." },
      { status: 403 }
    );
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
    .from("group_setlists")
    .update(updates)
    .eq("id", setlistId)
    .eq("group_id", groupId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Setlist not found." }, { status: 404 });
  return NextResponse.json({ setlist: data });
}

// Cascades to remove its group_setlist_songs rows -- the songs themselves
// (group_songs) are untouched, only their placement in this setlist goes.
export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, setlistId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can delete setlists." },
      { status: 403 }
    );
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("group_setlists").delete().eq("id", setlistId).eq("group_id", groupId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
