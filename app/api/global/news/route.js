import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyGlobal } from "@/lib/push";

const VALID_CATEGORIES = ["announcement", "pastor_message"];

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("global_news")
    .select("id, title, body, category, created_at, users(display_name)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ news: data });
}

// Church-wide announcements are admin-only to post, per the project's
// decision. category distinguishes a general Announcement from a Message
// from the Pastor -- same table, just a label the UI groups by.
export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { title, body, category } = await req.json();
  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "title and body are required." }, { status: 400 });
  }
  const finalCategory = category && VALID_CATEGORIES.includes(category) ? category : "announcement";

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("global_news")
    .insert({ title: title.trim(), body: body.trim(), category: finalCategory, created_by: user.id })
    .select("id, title, body, category, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  notifyGlobal({
    title: finalCategory === "pastor_message" ? "Message from the Pastor" : "Church News",
    body: title.trim(),
    url: "/",
  }).catch(() => {});

  return NextResponse.json({ news: data });
}
