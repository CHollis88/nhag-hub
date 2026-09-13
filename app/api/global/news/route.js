import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyGlobal } from "@/lib/push";

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("global_news")
    .select("id, title, body, created_at, users(display_name)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ news: data });
}

// Church-wide announcements are admin-only to post, per the project's
// decision. (Ministry Leaders push content globally via the promotion
// flow instead, once Phase 3's group News exists.)
export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { title, body } = await req.json();
  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "title and body are required." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("global_news")
    .insert({ title: title.trim(), body: body.trim(), created_by: user.id })
    .select("id, title, body, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort -- a push failure should never block the post itself from
  // succeeding, so this isn't awaited into the response's error path.
  notifyGlobal({ title: "Church News", body: title.trim(), url: "/" }).catch(() => {});

  return NextResponse.json({ news: data });
}
