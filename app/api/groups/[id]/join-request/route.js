import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id: groupId } = params;
  const supabase = supabaseServer();

  const { data: existing, error: existingError } = await supabase
    .from("group_members")
    .select("id, status")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (existing) {
    const message =
      existing.status === "active"
        ? "You're already a member of this group."
        : "You already have a pending request for this group.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("group_members")
    .insert({ group_id: groupId, user_id: user.id, role: "member", status: "pending" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}
