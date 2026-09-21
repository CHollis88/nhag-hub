import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { notifyGlobal, notifyAllLeaders } from "@/lib/push";
import { withNoStore } from "@/lib/cacheHeaders";
import { isAnyGroupLeader } from "@/lib/groupAuth";

const VALID_CATEGORIES = ["announcement", "pastor_message"];

export async function GET(req) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  // ?drafts=1 is the admin-only "Drafts" tab view -- everyone else only
  // ever sees published posts, so a draft is invisible to the general
  // membership until an admin explicitly publishes it.
  const wantDrafts = req.nextUrl.searchParams.get("drafts") === "1";
  if (wantDrafts && !user.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const supabase = supabaseServer();
  let query = supabase
    .from("global_news")
    .select("id, title, body, category, audience, pinned, status, created_at, users(display_name)")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  query = wantDrafts ? query.eq("status", "draft") : query.eq("status", "published");
  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // A 'leaders' audience post is filtered out here (application layer)
  // for anyone who isn't a leader of some ministry or a Church Admin --
  // same "shouldn't even know it exists" reasoning as group_news's
  // 'leader' kind.
  const canSeeLeaderPosts = await isAnyGroupLeader(user);
  const visible = canSeeLeaderPosts ? data : data.filter((n) => n.audience !== "leaders");

  return withNoStore({ news: visible });
}

// Church-wide announcements are admin-only to post, per the project's
// decision -- EXCEPT audience='leaders', a new capability Cam asked for
// specifically: any active leader (of any group) can post a church-wide
// leaders-only note, not just a Church Admin. The 'everyone' audience
// keeps the original admin-only rule unchanged.
// category distinguishes a general Announcement from a Message
// from the Pastor -- same table, just a label the UI groups by.
export async function POST(req) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { title, body, category, audience, status } = await req.json();
  const finalAudience = audience === "leaders" ? "leaders" : "everyone";
  const finalStatus = status === "draft" ? "draft" : "published";

  const authorized = finalAudience === "leaders" ? await isAnyGroupLeader(user) : user.is_church_admin;
  if (!authorized) {
    return NextResponse.json(
      {
        error:
          finalAudience === "leaders"
            ? "Only a ministry leader or Church Admin can post to the leaders channel."
            : "Church Admin access required.",
      },
      { status: 403 }
    );
  }

  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "title and body are required." }, { status: 400 });
  }
  const finalCategory = category && VALID_CATEGORIES.includes(category) ? category : "announcement";

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("global_news")
    .insert({
      title: title.trim(),
      body: body.trim(),
      category: finalCategory,
      audience: finalAudience,
      status: finalStatus,
      created_by: user.id,
    })
    .select("id, title, body, category, audience, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (finalStatus === "draft") {
    return NextResponse.json({ news: data });
  }

  if (finalAudience === "leaders") {
    notifyAllLeaders({ title: "Leaders Only", body: title.trim(), url: "/?tab=news" }).catch(() => {});
  } else {
    notifyGlobal({
      title: finalCategory === "pastor_message" ? "Message from the Pastor" : "Church News",
      body: title.trim(),
      url: "/?tab=news",
    }).catch(() => {});
  }

  return NextResponse.json({ news: data });
}
