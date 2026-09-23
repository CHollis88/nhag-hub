import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Streams a public Drive file's raw bytes through the app's own server,
// using Drive API v3's `alt=media` -- the officially supported way to
// fetch a file's content, unlike the old `uc?export=download` link
// (which routinely serves Google's "can't scan for viruses" HTML page
// instead of the real file for anything but the smallest files). This
// is what NativeAudioPlayer and NativePdfViewer point at.
//
// On ANY failure -- no API key configured, a network error, Drive
// returning a non-2xx status -- this redirects (302) to Google's own
// /preview page for the same file, rather than returning a JSON error
// body. That single behavior is what lets both callers degrade
// gracefully with no special-case fallback logic of their own:
//   - <audio src=proxyUrl> follows the redirect, can't decode the HTML
//     it lands on as audio, fires its normal error event, and
//     NativeAudioPlayer's existing onError handler takes it from there.
//   - <iframe src=proxyUrl> (NativePdfViewer) just follows the redirect
//     and ends up showing Google's own preview UI, automatically.
// Google's /preview URL needs nothing but the file ID -- no API key,
// no auth beyond what the file's own sharing settings allow -- so it's
// always buildable as a fallback target, even when the API key itself
// is what's missing.
//
// Forwards the incoming Range header upstream and passes the response
// straight through (status, Content-Type, Content-Range, etc.) --
// Range support is what lets the player's seek bar actually jump to a
// new position instead of only ever playing from the start.
export async function GET(req, { params }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const { fileId } = await params;
  if (!fileId) return NextResponse.json({ error: "fileId is required." }, { status: 400 });

  const fallbackUrl = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    return NextResponse.redirect(fallbackUrl);
  }

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
    return NextResponse.redirect(fallbackUrl);
  }

  if (!upstream.ok && upstream.status !== 206) {
    // 403 = file isn't actually public, or the key's Drive API
    // restriction is misconfigured. 404 = wrong/deleted file id.
    // Either way, fall back rather than surface a dead player.
    return NextResponse.redirect(fallbackUrl);
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
  // Render inline (a PDF opens in the viewer) rather than forcing a
  // browser download -- Drive API's alt=media response doesn't
  // reliably set this itself.
  headers.set("Content-Disposition", "inline");

  return new Response(upstream.body, { status: upstream.status, headers });
}
