import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

// Notifications clear themselves (v71.29): opening the screen a notification
// is about marks it read. The app sends the address of the screen you just
// opened (e.g. "/?group=<id>&tab=news"), and every unread notification of
// yours that points there is marked read. Returns your new unread count, so
// the bell badge updates without another request.
//   POST { prefixes: ["/?group=<id>&tab=news", ...] }
const SAFE = /^\/\?[a-z0-9=&_-]+$/i; // only this app's own screen addresses

export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { prefixes } = await req.json().catch(() => ({}));
  const list = (Array.isArray(prefixes) ? prefixes : []).filter((p) => typeof p === "string" && SAFE.test(p)).slice(0, 5);
  if (!list.length) return NextResponse.json({ error: "Nothing to mark." }, { status: 400 });

  const supabase = supabaseServer();
  // For each screen: notifications pointing exactly there, or there plus more
  // ("...&tab=chat" + "&channel=leaders"). The "&" stops "...tab=news" from
  // ever also clearing an unrelated "...tab=newsletter".
  for (const p of list) {
    const mark = (q) => q.update({ read: true }).eq("user_id", user.id).eq("read", false);
    const [a, b] = await Promise.all([
      mark(supabase.from("notifications")).eq("url", p),
      mark(supabase.from("notifications")).like("url", `${p}&%`),
    ]);
    const error = a.error || b.error;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);
  return NextResponse.json({ unread_count: count || 0 });
}
