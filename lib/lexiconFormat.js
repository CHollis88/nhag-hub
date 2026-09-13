// The source lexicon data has a bug where the "occurrences" field repeats
// its own list twice back-to-back (with a stray empty "()" between/after),
// e.g. "love(86x), charity(28x), (), love(86x), charity(28x), ()".
// This cleans it up to just the real, de-duplicated list.
export function cleanOccurrences(raw) {
  if (!raw) return "";
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && p !== "()");
  const n = parts.length;
  if (n > 0 && n % 2 === 0) {
    const half = n / 2;
    const firstHalf = parts.slice(0, half).join("|");
    const secondHalf = parts.slice(half).join("|");
    if (firstHalf === secondHalf) return parts.slice(0, half).join(", ");
  }
  // Fallback: just remove exact consecutive duplicates, preserving order.
  const seen = new Set();
  const deduped = parts.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
  return deduped.join(", ");
}
