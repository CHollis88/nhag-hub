import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isActiveGroupMember } from "@/lib/groupAuth";

// Toggles: tapping "I'm praying" again removes it and decrements the
// count, so the count always reflects how many people currently have it
// marked, not a one-way running total -- same mechanic as the Young
// Adults/Choir apps' own prayer_prayed table, adapted to use the
// authenticated user_id here instead of a device_id, since this app has
// real accounts rather than the anonymous-device model those used.
export async function POST(req, { params }) {
  const { id: groupId, prayerId } = await params;
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const supabase = supabaseServer();

  const { data: existing } = await supabase
    .from("group_prayer_supporters")
    .select("user_id")
    .eq("prayer_id", prayerId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: current, error: fetchError } = await supabase
    .from("group_prayer")
    .select("pray_count")
    .eq("id", prayerId)
    .single();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  if (existing) {
    const { error: deleteError } = await supabase
      .from("group_prayer_supporters")
      .delete()
      .eq("prayer_id", prayerId)
      .eq("user_id", user.id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    const { error: updateError } = await supabase
      .from("group_prayer")
      .update({ pray_count: Math.max(0, (current.pray_count || 0) - 1) })
      .eq("id", prayerId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true, praying: false });
  }

  const { error: insertError } = await supabase
    .from("group_prayer_supporters")
    .insert({ prayer_id: prayerId, user_id: user.id });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { error: updateError } = await supabase
    .from("group_prayer")
    .update({ pray_count: (current.pray_count || 0) + 1 })
    .eq("id", prayerId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, praying: true });
}
