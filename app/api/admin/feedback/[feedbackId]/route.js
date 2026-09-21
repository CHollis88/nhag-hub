import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { feedbackId } = await params;
  const { resolved } = await req.json();

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("feedback")
    .update({ resolved: Boolean(resolved) })
    .eq("id", feedbackId)
    .select("id, resolved")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
  return NextResponse.json({ feedback: data });
}

export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { feedbackId } = await params;
  const supabase = supabaseServer();
  const { error } = await supabase.from("feedback").delete().eq("id", feedbackId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
