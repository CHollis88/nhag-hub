import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { withNoStore } from "@/lib/cacheHeaders";
import { makeCalendarToken } from "@/lib/calendarToken";

// The signed-in person's private calendar link (for the Calendar tab's
// "Sync to phone calendar" button).
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const path = `/api/calendar/feed/${makeCalendarToken(user.id)}`;
  return withNoStore({ https: `https://${host}${path}`, webcal: `webcal://${host}${path}` });
}
