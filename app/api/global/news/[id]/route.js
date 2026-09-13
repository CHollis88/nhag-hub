import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { title, body } = await req.json();
  const updates = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title.trim();
  if (body !== undefined) updates.body = body.trim();

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("global_news")
    .update(updates)
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  return NextResponse.json({ news: data });
}

export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("global_news").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
