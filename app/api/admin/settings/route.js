import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppSettings, setAppSettings } from "@/lib/appSettings";
import { logActivity } from "@/lib/activityLog";
import { withNoStore } from "@/lib/cacheHeaders";

// Church settings in the Admin Toolbox: church prayer on/off and the service
// times shown on Home's "This Sunday" card. Effective admins only.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  return withNoStore({ settings: await getAppSettings() });
}

export async function PATCH(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const patch = {};
  if ("church_prayer_enabled" in body) patch.church_prayer_enabled = Boolean(body.church_prayer_enabled);
  if ("service_times" in body) {
    const text = String(body.service_times ?? "").trim();
    if (text.length > 500) return NextResponse.json({ error: "Service times can be up to 500 characters." }, { status: 400 });
    patch.service_times = text;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const { error } = await setAppSettings(patch, user.id);
  if (error) {
    const missing = /app_settings/.test(error.message || "") || error.code === "42P01" || error.code === "PGRST205";
    return NextResponse.json(
      { error: missing ? "This needs the v71.29 database update (migration 040). Ask the admin to run it." : error.message },
      { status: 500 }
    );
  }

  const who = user.display_name || "An admin";
  if ("church_prayer_enabled" in patch) {
    logActivity(user.id, "church_prayer_toggled", `${who} turned church prayer ${patch.church_prayer_enabled ? "on" : "off"}`);
  }
  if ("service_times" in patch) logActivity(user.id, "service_times_updated", `${who} updated the service times`);

  return withNoStore({ settings: await getAppSettings() });
}
