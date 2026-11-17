import { NextResponse } from "next/server";
import { getAppSettings } from "@/lib/appSettings";

// Church-wide prayer is on unless an admin switched it off in the Admin
// Toolbox. While it's off, nothing can be read or added (the requests are
// kept, and come back when it's switched on again).
export async function churchPrayerOffResponse() {
  const { church_prayer_enabled } = await getAppSettings();
  if (church_prayer_enabled) return null;
  return NextResponse.json({ error: "Church prayer is turned off right now." }, { status: 403 });
}
