import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { logActivity } from "@/lib/activityLog";

// Approving creates a COPY on the global feed (not a link) -- per the
// project's decision, linking back to group content would leak access to
// people outside that group. The copy is attributed to the group by name
// in the title, and is locked from further editing by the original
// leader (nothing here gives leaders write access to global_news).
export async function POST(req, { params }) {
  const admin = await getCurrentUser(req);
  if (!admin?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { requestId } = await params;
  const supabase = supabaseServer();

  const { data: request, error: requestError } = await supabase
    .from("group_promotion_requests")
    .select("id, group_id, source_type, source_id, status, groups(name)")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError) return NextResponse.json({ error: requestError.message }, { status: 500 });
  if (!request) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (request.status !== "pending") {
    return NextResponse.json({ error: "This request has already been reviewed." }, { status: 409 });
  }

  const { data: original, error: originalError } = await supabase
    .from("group_news")
    .select("title, body")
    .eq("id", request.source_id)
    .maybeSingle();

  if (originalError) return NextResponse.json({ error: originalError.message }, { status: 500 });
  if (!original) return NextResponse.json({ error: "Original post no longer exists." }, { status: 404 });

  const { error: insertError } = await supabase.from("global_news").insert({
    title: `${request.groups.name}: ${original.title}`,
    body: original.body,
    created_by: admin.id,
  });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { data: updated, error: updateError } = await supabase
    .from("group_promotion_requests")
    .update({ status: "approved", reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  logActivity(admin.id, "promotion_approved", `Approved "${original.title}" from ${request.groups.name}`);
  return NextResponse.json({ request: updated });
}
