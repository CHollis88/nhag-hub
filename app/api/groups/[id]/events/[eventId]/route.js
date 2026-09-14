import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";

export async function DELETE(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, eventId } = await params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can delete Events." },
      { status: 403 }
    );
  }

  const scope = new URL(req.url).searchParams.get("scope");
  const supabase = supabaseServer();

  if (scope === "series") {
    const { data: event, error: fetchError } = await supabase
      .from("group_events")
      .select("recurrence_group_id, event_date")
      .eq("id", eventId)
      .eq("group_id", groupId)
      .maybeSingle();
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

    if (event?.recurrence_group_id) {
      const { error } = await supabase
        .from("group_events")
        .delete()
        .eq("group_id", groupId)
        .eq("recurrence_group_id", event.recurrence_group_id)
        .gte("event_date", event.event_date);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
  }

  const { error } = await supabase.from("group_events").delete().eq("id", eventId).eq("group_id", groupId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
