import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { canManageGroup } from "@/lib/groupAuth";

// Leader (or admin) requests that a group News post get pushed to the
// church-wide Home feed. This does NOT post it globally itself -- it just
// queues a request. An admin has to approve it (see
// /api/admin/promotion-requests) before it appears anywhere outside the
// group. Per the project's decision, this only ever applies to News.
export async function POST(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId, newsId } = params;
  if (!(await canManageGroup(user, groupId))) {
    return NextResponse.json(
      { error: "Only this group's leaders or a Church Admin can request a promotion." },
      { status: 403 }
    );
  }

  const supabase = supabaseServer();

  const { data: news, error: newsError } = await supabase
    .from("group_news")
    .select("id")
    .eq("id", newsId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (newsError) return NextResponse.json({ error: newsError.message }, { status: 500 });
  if (!news) return NextResponse.json({ error: "News post not found." }, { status: 404 });

  const { data: existing, error: existingError } = await supabase
    .from("group_promotion_requests")
    .select("id, status")
    .eq("source_type", "news")
    .eq("source_id", newsId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing) {
    return NextResponse.json({ error: "A promotion request for this post is already pending." }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("group_promotion_requests")
    .insert({
      group_id: groupId,
      requested_by: user.id,
      source_type: "news",
      source_id: newsId,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}
