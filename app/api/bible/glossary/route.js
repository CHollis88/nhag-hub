import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { withPublicCache } from "@/lib/cacheHeaders";

let cache = null;

export async function GET() {
  if (!cache) {
    const filePath = path.join(process.cwd(), "data", "bible", "new-christian-glossary.json");
    cache = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  return withPublicCache({ entries: cache });
}
