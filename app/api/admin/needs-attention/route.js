import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { withNoStore } from "@/lib/cacheHeaders";
import { listNeedsAttention } from "@/lib/needsAttention";

// The Admin Toolbox's single "Needs attention" list (v71 #22). Effective
// admins only -- a session with Admin Privileges off gets a 403, like any
// other admin route.
export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user?.is_church_admin) return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });

  try {
    return withNoStore(await listNeedsAttention(supabaseServer()));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
