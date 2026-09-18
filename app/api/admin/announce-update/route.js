import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { notifyGlobal } from "@/lib/push";
import { logActivity } from "@/lib/activityLog";
import { PATCH_NOTES } from "@/lib/patchNotes";

// Admin-only, manually triggered -- there's no automatic hook into the
// actual Vercel deploy pipeline, so a Church Admin presses this once
// after a new build is live, to let everyone know an update shipped and
// point them at What's New. Always uses the newest patchNotes.js entry,
// so there's nothing to type in here -- just confirm and send.
export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const latest = PATCH_NOTES[0];
  if (!latest) {
    return NextResponse.json({ error: "No patch notes entry to announce." }, { status: 400 });
  }

  await notifyGlobal({
    title: "The app just updated",
    body: `${latest.title} — close the app fully and reopen it to get the update, then tap to see what's new.`,
    url: "/?whatsnew=1",
  });

  logActivity(user.id, "update_announced", `Announced the "${latest.title}" update to everyone`);
  return NextResponse.json({ ok: true });
}
