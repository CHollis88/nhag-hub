import { createClient } from "@supabase/supabase-js";

// Server-side only. Uses the service role key, which bypasses Row Level
// Security, so it must NEVER be imported into client components or exposed
// to the browser. Every /app/api route that touches the database imports
// this file, not the other way around.
let cachedClient = null;

export function supabaseServer() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  cachedClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  return cachedClient;
}
