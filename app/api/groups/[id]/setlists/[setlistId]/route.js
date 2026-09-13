import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";

const VALID_SERVICES = ["AM", "PM", "CP"];

export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, setlistId } = params;
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

  const { id: groupId, setlistId } = params;
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
