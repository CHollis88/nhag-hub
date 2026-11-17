import { supabaseServer } from "@/lib/supabaseServer";

// Church settings an admin changes in the Admin Toolbox (migration_040's
// app_settings table): church prayer on/off and the service times shown on
// Home. Read on most Home loads, so each server instance keeps them for a
// few seconds; a change made here clears that copy at once.
//
// Before migration_040 is applied the table doesn't exist: the defaults
// below apply (church prayer OFF, so nothing points at tables that aren't
// there yet; no service times).
export const SETTING_DEFAULTS = {
  church_prayer_enabled: false,
  service_times: "",
};

const CACHE_MS = 15 * 1000;
let cached = null; // { at, values }

export async function getAppSettings() {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.values;
  const values = { ...SETTING_DEFAULTS };
  try {
    const { data, error } = await supabaseServer().from("app_settings").select("key, value");
    if (!error) for (const row of data || []) if (row.key in values) values[row.key] = row.value;
  } catch {
    // keep the defaults
  }
  cached = { at: Date.now(), values };
  return values;
}

export async function setAppSettings(patch, userId) {
  const rows = Object.entries(patch)
    .filter(([key]) => key in SETTING_DEFAULTS)
    .map(([key, value]) => ({ key, value, updated_at: new Date().toISOString(), updated_by: userId }));
  if (rows.length === 0) return { error: null };
  const { error } = await supabaseServer().from("app_settings").upsert(rows, { onConflict: "key" });
  cached = null;
  return { error };
}
