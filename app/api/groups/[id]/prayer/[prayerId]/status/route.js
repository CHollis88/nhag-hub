import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { isActiveGroupMember } from "@/lib/groupAuth";
import { notifyGroup } from "@/lib/push";

const VALID_STATUSES = ["open", "answered", "still-praying"];

// Only the prayer's own author (or a leader/admin, for cleanup cases
// like an inactive author) can update its status -- this is a personal
// update on someone's own request, not a moderation action.
export async function PATCH(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, prayerId } = await params;
  if (!(await isActiveGroupMember(user, groupId))) {
    return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });
  }

  const { status } = await req.json();
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: prayer, error: fetchError } = await supabase
    .from("group_prayer")
    .select("created_by, body, is_anonymous")
    .eq("id", prayerId)
    .single();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  if (prayer.created_by !== user.id) {
    return NextResponse.json({ error: "Only the person who submitted this request can update its status." }, { status: 403 });
  }

  const { error } = await supabase
    .from("group_prayer")
    .update({ status, status_updated_at: new Date().toISOString() })
    .eq("id", prayerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Only notify the group for the "answered" milestone -- a genuine
  // celebration worth a push. "still-praying" is just a status refresh,
  // not news, so it stays silent.
  if (status === "answered") {
    notifyGroup(groupId, {
      title: "A prayer was answered 🙏",
      body: prayer.is_anonymous ? "Someone's prayer request was answered." : "Tap to see what happened.",
      url: `/?group=${groupId}&tab=prayer`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, status });
}
