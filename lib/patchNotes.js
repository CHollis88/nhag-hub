// Patch notes shown in-app (Settings > What's New). This is a plain data
// file, not an admin feature -- there's no in-app way to add an entry,
// on purpose. Cam reviews and edits this file directly as part of each
// build; members only ever see it rendered, read-only, in
// PatchNotesView. Newest entry first.
//
// Format per entry:
//   version: package.json's version -- bump both together each release.
//   date: "YYYY-MM-DD" -- drives the "new" dot (Settings > What's New)
//     via the same lastSeen mechanism as everything else in this app.
//   title: short, member-facing summary of the release.
//   items: plain-language bullets, grouped loosely by theme where it
//     helps. Written for a general member, not a developer -- describe
//     what changed for someone using the app, not how it was built.
export const PATCH_NOTES = [
  {
    version: "61.0.1",
    date: "2026-09-18",
    title: "Direct Messages, Chat, and a round of bug fixes",
    items: [
      "Added Messages: private conversations between a member and a ministry's leader(s), with emoji reactions and a mute option per conversation.",
      "Added Chat: a shared conversation for a ministry, with a Members channel and an optional Leaders Only channel a ministry can turn on independently.",
      "Fixed notifications not always opening the right screen when tapped.",
      "Fixed several mobile issues: the keyboard covering the message box, text zooming in unexpectedly while typing, and the bottom navigation bar overlapping content.",
      "Fixed a bug where Bible highlights, notes, and tags sometimes didn't show up until the app was manually refreshed.",
      "Fixed admin actions (promoting someone, approving a join request) not visibly updating until a manual refresh.",
      "Added a small dot on ministry tabs (News, Events, Prayer, Messages, Chat) when there's something new to see.",
      "Simplified ministry cards on Home to show just the icon and name on phones — tap a card to see its full details, including its leaders.",
      "Home now shows just your single most recent announcement and next upcoming event, instead of three.",
      "Expanded Help & FAQ, including how to add this app to your phone's Home Screen and more detail on the Bible tab.",
      "Added a refresh button to every screen's header, not just Home.",
    ],
  },
];
