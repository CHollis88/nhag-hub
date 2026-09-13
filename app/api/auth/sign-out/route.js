import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, deleteSessionByToken } from "@/lib/session";

export async function POST(req) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  await deleteSessionByToken(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
