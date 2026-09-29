import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { purgeInBatches } from "@/lib/cleanup";

// Called on a schedule by Vercel Cron (see vercel.json) -- protected by
// the same shared secret as the reading reminder. Per the project's
// decision, News and Events auto-hard-delete after 30 days, church-wide
// and in every ministry alike. Prayer is deliberately NOT included here
// -- only News/Events were asked for.
//
// For News, "30 days" means 30 days since it was posted (created_at).
// For Events, it means 30 days since the event itself happened
// (event_date) -- so an event scheduled for next month never
// disappears just because it was created a month ago; the clock starts
// when the event date passes, not when it was created.
//
// Direct Messages and Group Chat (migrations 026/027) also auto-delete,
// on their own longer clock -- 90 days since a message was sent. These
// are conversational, not archival like News, so a longer window than
// News/Events made sense; unlike News/Events there's no external
// document a leader would need to reference indefinitely, so a rolling
// window keeps storage bounded without needing an admin to manage it.
// Reactions (migration_028) have no foreign-key cascade to either
// message table -- one shared table serves both DM and Chat messages
// via a message_type discriminator, so a DB-level cascade isn't
// possible -- meaning a deleted message's reactions must be deleted
// here explicitly first, or they'd become permanently orphaned rows.
// post_reactions (migration_030) has the same no-foreign-key shape for
// News, so a deleted News post's reactions are removed with it (v71 #16).
//
// v71 #16: every step's result is CHECKED; deletes run in bounded batches
// (lib/cleanup.js) instead of loading every id at once; and a failure is
// reported as a failure -- a non-2xx response, visible in Vercel's cron
// logs -- rather than "ok: true". One table failing doesn't stop the rest.
export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = supabaseServer();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgoDate = thirtyDaysAgo.slice(0, 10); // date-only, for event_date columns
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Stop starting new batches well before a serverless time limit; whatever
  // is left is simply picked up by tomorrow's run.
  const deadline = Date.now() + 8000;

  const tasks = [
    { key: "global_news", table: "global_news", column: "created_at", cutoff: thirtyDaysAgo,
      reactions: { table: "post_reactions", typeColumn: "post_type", type: "global_news", idColumn: "post_id" } },
    { key: "global_events", table: "global_events", column: "event_date", cutoff: thirtyDaysAgoDate },
    { key: "group_news", table: "group_news", column: "created_at", cutoff: thirtyDaysAgo,
      reactions: { table: "post_reactions", typeColumn: "post_type", type: "group_news", idColumn: "post_id" } },
    { key: "group_events", table: "group_events", column: "event_date", cutoff: thirtyDaysAgoDate },
    { key: "dm_messages", table: "group_dm_messages", column: "created_at", cutoff: ninetyDaysAgo,
      reactions: { table: "message_reactions", typeColumn: "message_type", type: "dm", idColumn: "message_id" } },
    { key: "chat_messages", table: "group_chat_messages", column: "created_at", cutoff: ninetyDaysAgo,
      reactions: { table: "message_reactions", typeColumn: "message_type", type: "group_chat", idColumn: "message_id" } },
  ];

  const results = {};
  const errors = [];
  const incomplete = [];

  for (const task of tasks) {
    const outcome = await purgeInBatches(supabase, task, { deadline });
    results[`${task.key}_deleted`] = outcome.deleted;
    if (outcome.error) errors.push(outcome.error);
    else if (!outcome.complete) incomplete.push(task.key);
  }

  const body = { ok: errors.length === 0, ...results };
  if (incomplete.length) body.incomplete = incomplete; // more remains; next run continues
  if (errors.length) {
    body.errors = errors;
    console.error("cleanup-old-content failed:", errors);
    return NextResponse.json(body, { status: 500 });
  }
  return NextResponse.json(body);
}
