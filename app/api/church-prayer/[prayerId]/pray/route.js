import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { rpcFailure } from "@/lib/rpc";
import { churchPrayerOffResponse } from "@/lib/churchPrayer";

// "I'm praying" on a church-wide request: toggled atomically in the database
// (toggle_global_prayer, migration_040), and the authoritative count comes
// back. No notification (church prayer never pings anyone).
export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const off = await churchPrayerOffResponse();
  if (off) return off;

  const { prayerId } = await params;
  const { data, error } = await supabaseServer().rpc("toggle_global_prayer", { p_prayer_id: prayerId, p_user_id: user.id });
  if (error) return rpcFailure(error);
  if (data?.status !== "ok") return NextResponse.json({ error: "Prayer request not found." }, { status: 404 });
  return NextResponse.json({ ok: true, i_prayed: data.i_prayed, pray_count: data.pray_count });
}
