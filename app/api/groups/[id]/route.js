import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

const VALID_FEATURES = ["songs_setlists", "reading_plan_journal"];

export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { id } = params;
  const { name, type, features } = await req.json();

  const updates = { updated_at: new Date().toISOString() };
  if (name !== undefined) {
    if (!name.trim()) {
      return NextResponse.json({ error: "name cannot be empty." }, { status: 400 });
    }
    updates.name = name.trim();
  }
  if (type !== undefined) {
    updates.type = type.trim();
  }
  if (features !== undefined) {
    updates.features = Array.isArray(features) ? features.filter((f) => VALID_FEATURES.includes(f)) : [];
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("groups")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  return NextResponse.json({ group: data });
}

// Hard delete, per the project's decision that group deletion doesn't need
// to preserve/archive anything. Cascades to group_members and
// group_promotion_requests via foreign key ON DELETE CASCADE.
export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { id } = params;
  const supabase = supabaseServer();
  const { error } = await supabase.from("groups").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
