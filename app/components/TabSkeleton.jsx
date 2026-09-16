import { SkeletonList } from "./Skeleton";

// Shown by next/dynamic while a tab's JS chunk is still downloading (first
// visit to that tab only -- cached on every visit after). Mirrors the
// general shape of a tab (title + list of cards) so the swap-in doesn't
// jump the layout around once the real content arrives.
export default function TabSkeleton() {
  return (
    <div className="px-5 pt-4 pb-6">
      <div className="animate-pulse rounded-md bg-line/60 h-6 w-32 mb-4" />
      <SkeletonList count={3} />
    </div>
  );
}
