import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";
import { requireRecentPin } from "@/lib/adminAuth";
import { logActivity } from "@/lib/activityLog";

// v71.25 -- admin data export. On demand only (nothing runs unless the admin
// taps a button), PIN re-check required, and it reads each table in bulk.
//
//   ?kind=backup  -> JSON of the church's own content
//   ?kind=members -> CSV: who belongs to which ministry
//
// Deliberately NOT included: direct messages, group chat, prayer requests,
// journals, Bible notes -- those are personal, and a download that leaves
// the app is the wrong place for them. Passwords/PINs/sessions never leave
// the database either.

const BACKUP_TABLES = [
  "groups", "global_news", "global_events", "group_news", "group_events",
  "sermon_series", "sermons", "programs", "group_songs", "group_setlists",
  "group_setlist_songs", "program_songs", "program_setlists", "program_setlist_songs",
];

async function readAll(supabase, table) {
  const out = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + 999);
    if (error) return { error: error.message, rows: out };
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { rows: out };
}

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }
  const blocked = requireRecentPin(user);
  if (blocked) return blocked;

  const kind = req.nextUrl.searchParams.get("kind");
  const supabase = supabaseServer();
  const stamp = new Date().toISOString().slice(0, 10);

  if (kind === "members") {
    const [users, groups, members] = await Promise.all([
      supabase.from("users").select("id, username, display_name, is_church_admin").not("username", "is", null),
      readAll(supabase, "groups"),
      readAll(supabase, "group_members"),
    ]);
    if (users.error) return NextResponse.json({ error: users.error.message }, { status: 500 });
    const gName = new Map(groups.rows.map((g) => [g.id, g.name]));
    const byUser = new Map();
    for (const m of members.rows) {
      if (!byUser.has(m.user_id)) byUser.set(m.user_id, []);
      byUser.get(m.user_id).push(m);
    }
    const lines = [["Name", "Username", "Church admin", "Ministry", "Role", "Status"].join(",")];
    for (const u of (users.data || []).sort((a, b) => String(a.display_name).localeCompare(String(b.display_name)))) {
      const ms = byUser.get(u.id) || [];
      const base = [u.display_name, u.username, u.is_church_admin ? "yes" : "no"];
      if (!ms.length) lines.push([...base, "", "", ""].map(csvCell).join(","));
      for (const m of ms) lines.push([...base, gName.get(m.group_id) || "", m.role, m.status].map(csvCell).join(","));
    }
    logActivity(user.id, "export_members", `${user.display_name} downloaded the member list`);
    return withNoStore({ filename: `nhag-members-${stamp}.csv`, mime: "text/csv", content: lines.join("\r\n") + "\r\n" });
  }

  if (kind === "backup") {
    const results = await Promise.all(BACKUP_TABLES.map((t) => readAll(supabase, t)));
    const tables = {};
    const problems = [];
    BACKUP_TABLES.forEach((t, i) => {
      tables[t] = results[i].rows;
      if (results[i].error) problems.push(`${t}: ${results[i].error}`);
    });
    const payload = { exported_at: new Date().toISOString(), app: "NHAG Church Hub", tables, problems };
    logActivity(user.id, "export_backup", `${user.display_name} downloaded a content backup`);
    return withNoStore({ filename: `nhag-backup-${stamp}.json`, mime: "application/json", content: JSON.stringify(payload, null, 2) });
  }

  return NextResponse.json({ error: "Unknown export." }, { status: 400 });
}
