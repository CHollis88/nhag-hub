import { NextResponse, NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isActiveGroupMember, canManageGroup } from "@/lib/groupAuth";
import { withNoStore } from "@/lib/cacheHeaders";
import { GET as getNews } from "../news/route";
import { GET as getEvents } from "../events/route";
import { GET as getPrayer } from "../prayer/route";
import { GET as getMembers } from "../members/route";
import { GET as getSetlists } from "../setlists/route";
import { GET as getPrograms } from "../programs/route";

// Opening a ministry: everything its main tabs show, in ONE request instead
// of one request per tab as you tap around. Each part is produced by that
// tab's own route (same permission checks, same data, same shape), so this
// can never show anyone something the individual tab wouldn't. A part that
// fails or isn't allowed comes back null, and that tab simply loads itself
// when opened, like before.
//
// Not included on purpose: the song library (the one large list; it loads
// when Songs/Setlists opens), Messages and Chat (live, and opening them marks
// things read), the reading-plan tabs, and curriculum files.
const PARTS = {
  news: getNews,
  events: getEvents,
  prayer: getPrayer,
  members: getMembers,
  setlists: getSetlists,
  programs: getPrograms,
};

export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { id: groupId } = await params;
  const allowed = (await canManageGroup(user, groupId)) || (await isActiveGroupMember(user, groupId));
  if (!allowed) return NextResponse.json({ error: "You're not a member of this group." }, { status: 403 });

  const wanted = (req.nextUrl.searchParams.get("parts") || "")
    .split(",")
    .map((p) => p.trim())
    .filter((p, i, all) => PARTS[p] && all.indexOf(p) === i);

  const results = await Promise.all(
    wanted.map(async (part) => {
      try {
        const subReq = new NextRequest(new URL(`/api/groups/${groupId}/${part}`, req.url), { headers: req.headers });
        const res = await PARTS[part](subReq, { params: Promise.resolve({ id: groupId }) });
        if (!res || res.status !== 200) return [part, null];
        return [part, await res.json()];
      } catch (err) {
        console.error(`[group bundle] ${part}:`, err?.message);
        return [part, null];
      }
    })
  );

  return withNoStore(Object.fromEntries(results));
}
