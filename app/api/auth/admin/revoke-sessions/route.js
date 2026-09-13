import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteAllSessionsForUser } from "@/lib/session";

export async function POST(req) {
  const admin = await getCurrentUser(req);
  if (!admin?.is_church_admin) {
    return NextResponse.json({ error: "Church Admin access required." }, { status: 403 });
  }

  const { user_id } = await req.json();
  if (!user_id) {
    return NextResponse.json({ error: "user_id is required." }, { status: 400 });
  }

  await deleteAllSessionsForUser(user_id);
  return NextResponse.json({ ok: true });
}
