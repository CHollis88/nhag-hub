import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyAdmins } from "@/lib/push";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { id: groupId } = await params;

  // A malformed or missing group ID previously fell straight through to
  // Postgres, which threw a raw "invalid input syntax for type uuid"
  // error -- confusing to see as a user-facing message. Catching it here
  // gives a clean, actionable error instead.
  if (!groupId || !UUID_RE.test(groupId)) {
    return NextResponse.json({ error: "Invalid group." }, { status: 400 });
  }

  const supabase = supabaseServer();

  // Defense in depth: a per-user hidden ministry (migration_029) is
  // already kept out of Home/Directory discovery, but block the request
  // directly too, in case it's ever hit without going through the UI.
  const { data: userHidden } = await supabase
    .from("user_hidden_groups")
    .select("group_id")
    .eq("user_id", user.id)
    .eq("group_id", groupId)
    .maybeSingle();
  if (userHidden) {
    return NextResponse.json({ error: "This ministry isn't available to join." }, { status: 403 });
  }

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

  const { data: group } = await supabase.from("groups").select("name").eq("id", groupId).maybeSingle();
  notifyAdmins({
    title: "Join Request",
    body: `${user.display_name} wants to join ${group?.name || "a ministry"}.`,
    url: "/",
  }).catch(() => {});

  return NextResponse.json({ request: data });
}
