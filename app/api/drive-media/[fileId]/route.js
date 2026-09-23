import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Streams a public Drive file's raw bytes through the app's own server,
// using Drive API v3's `alt=media` -- the officially supported way to
// fetch a file's content, unlike the old `uc?export=download` link
// (which routinely serves Google's "can't scan for viruses" HTML page
// instead of the real file for anything but the smallest files). This
// is what NativeAudioPlayer actually points its <audio src> at.
//
// Forwards the incoming Range header upstream and passes the response
// straight through (status, Content-Type, Content-Range, etc.) --
// Range support is what lets the player's seek bar actually jump to a
// new position instead of only ever playing from the start.
export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_DRIVE_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const { fileId } = await params;
  if (!fileId) return NextResponse.json({ error: "fileId is required." }, { status: 400 });

  const upstreamHeaders = {};
  const range = req.headers.get("range");
  if (range) upstreamHeaders.Range = range;

  let upstream;
  try {
    upstream = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${apiKey}`,
      { headers: upstreamHeaders }
    );
  } catch {
    return NextResponse.json({ error: "Couldn't reach Google Drive." }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    // Bubble the real status up (403 = not actually public / key
    // restricted wrong, 404 = file id wrong or deleted) so it's
    // debuggable, rather than masking everything as a generic 500.
    return NextResponse.json(
      { error: `Drive returned ${upstream.status}. Check the file is shared "anyone with the link" and the API key is unrestricted for Drive API.` },
      { status: upstream.status }
    );
  }

  const headers = new Headers();
  const passthrough = ["content-type", "content-length", "content-range", "accept-ranges"];
  for (const h of passthrough) {
    const value = upstream.headers.get(h);
    if (value) headers.set(h, value);
  }
  // Never cache media bytes at a shared/proxy layer keyed just by URL --
  // each of these is a distinct file, but there's no benefit to caching
  // here specifically, and it keeps behavior simple and predictable.
  headers.set("Cache-Control", "private, no-store");

  return new Response(upstream.body, { status: upstream.status, headers });
}
