// v71.25 -- phone share sheet. Uses the device's native share sheet when
// there is one (Messages, WhatsApp, Mail...), and falls back to copying the
// text to the clipboard. Returns "shared" | "copied" | "cancelled" | "failed".
export async function shareText({ title, text, url }) {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text, url });
      return "shared";
    }
  } catch (err) {
    if (err?.name === "AbortError") return "cancelled";
    // fall through to clipboard
  }
  try {
    const full = [text, url].filter(Boolean).join("\n");
    await navigator.clipboard.writeText(full);
    return "copied";
  } catch {
    return "failed";
  }
}

export function eventShareText(e) {
  const when = [e.event_date, e.event_time].filter(Boolean).join(" ");
  return [e.title, when, e.location].filter(Boolean).join(" · ");
}
