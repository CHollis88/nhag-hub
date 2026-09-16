// Skeleton loaders: gray placeholder shapes shown while data is loading,
// instead of plain "Loading..." text. Same load time under the hood, but
// reads as "content is forming" rather than "something stalled" -- a
// perceived-speed win that costs nothing on the network.
//
// Built from the app's own design tokens (bg-line/bg-linesoft) so it
// respects light/dark mode automatically, no extra theming needed.

export function SkeletonBlock({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-line/60 ${className}`} />;
}

// A single card-shaped placeholder -- matches the .sp-card shape used
// throughout News/Events/Prayer/Sermons lists.
export function SkeletonCard({ lines = 2 }) {
  return (
    <div className="sp-card">
      <div className="flex items-center gap-2 mb-3">
        <SkeletonBlock className="h-3 w-20" />
        <SkeletonBlock className="h-3 w-14" />
      </div>
      <SkeletonBlock className="h-4 w-3/4 mb-2" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} className="h-3 w-full mb-1.5" />
      ))}
    </div>
  );
}

// A list of skeleton cards -- drop-in replacement for a "Loading..." string
// wherever a tab renders a list of items (news, events, prayers, sermons).
export function SkeletonList({ count = 3, lines = 2 }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  );
}

// A single-line skeleton row -- for compact lists (roster, directory,
// notification list rows).
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <SkeletonBlock className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1">
        <SkeletonBlock className="h-3.5 w-2/5 mb-1.5" />
        <SkeletonBlock className="h-3 w-3/5" />
      </div>
    </div>
  );
}

export function SkeletonRowList({ count = 5 }) {
  return (
    <div className="divide-y divide-linesoft">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
