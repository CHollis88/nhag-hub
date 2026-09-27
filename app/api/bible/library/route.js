import { NextResponse } from "next/server";
import { withPublicCache } from "@/lib/cacheHeaders";
import { LIBRARY_COLLECTIONS, getCollectionIndex, getCollectionItem } from "@/lib/tyndaleLibrary";

// Library content (Tyndale book intros, theme notes, articles, charts).
//   ?collection=themes          -> { items: [{ id, title }] }   (index only)
//   ?collection=themes&id=...   -> { item: { id, title, blocks, ... } }
// Static, unauthenticated content, so public caching is safe here.
export async function GET(req) {
  const collection = req.nextUrl.searchParams.get("collection");
  const id = req.nextUrl.searchParams.get("id");

  if (!LIBRARY_COLLECTIONS.includes(collection)) {
    return NextResponse.json({ error: "Unknown collection." }, { status: 400 });
  }

  if (id) {
    const item = getCollectionItem(collection, id);
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return withPublicCache({ item });
  }
  return withPublicCache({ items: getCollectionIndex(collection) });
}
