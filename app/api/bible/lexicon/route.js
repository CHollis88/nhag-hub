import { NextResponse } from "next/server";
import { getLexiconEntry } from "@/lib/bible";

export async function GET(req) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const entry = getLexiconEntry(id.toUpperCase());
  if (!entry) return NextResponse.json({ error: "No entry found for that Strong's number." }, { status: 404 });

  return NextResponse.json({ id: id.toUpperCase(), entry });
}
