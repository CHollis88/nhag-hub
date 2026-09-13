import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

// Returns this user's current preferences for every group they're an
// active member of, plus the global toggle. No row in the DB for a given
// scope means enabled (opt-out default) -- see migration_007's comment.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = supabaseServer();

  const { data: globalRow } = await supabase
    .from("global_notification_prefs")
    .select("enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id, groups(name)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const { data: groupPrefs } = await supabase
    .from("group_notification_prefs")
    .select("group_id, enabled")
    .eq("user_id", user.id);

  const prefsByGroup = Object.fromEntries((groupPrefs || []).map((p) => [p.group_id, p.enabled]));

  const groups = (memberships || []).map((m) => ({
    group_id: m.group_id,
    name: m.groups?.name,
    enabled: prefsByGroup[m.group_id] !== undefined ? prefsByGroup[m.group_id] : true,
  }));

  return NextResponse.json({
    global: globalRow ? globalRow.enabled : true,
    groups,
  });
}

// Body: { scope: "global" } or { scope: "group", group_id }, plus enabled.
export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { scope, group_id, enabled } = await req.json();
  const supabase = supabaseServer();

  if (scope === "global") {
    const { error } = await supabase
      .from("global_notification_prefs")
      .upsert({ user_id: user.id, enabled: Boolean(enabled), updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (scope === "group") {
    if (!group_id) return NextResponse.json({ error: "group_id is required." }, { status: 400 });
    const { error } = await supabase.from("group_notification_prefs").upsert({
      user_id: user.id,
      group_id,
      enabled: Boolean(enabled),
      updated_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "scope must be 'global' or 'group'." }, { status: 400 });
}
