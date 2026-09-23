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
    version: "66.0.0",
    date: "2026-09-22",
    title: "Prayer follow-ups, reactions, profiles, a real Directory tab, and more",
    items: [
      "Added a Directory tab to the main navigation — browse every ministry and its leaders, and tap a member's name anywhere to see their profile and bio.",
      "Added a short bio to your Profile, visible to other members.",
      "Added reactions (👍 ❤️ 🙏 😂 😢) to News posts and Prayer requests.",
      "Prayer requests can now be marked \"Still Praying\" or \"Answered\" by the person who posted them, with a note to the group when a prayer is answered.",
      "News posts (ministry and church-wide) can now be saved as drafts and published later — look for the Drafts view if you're a leader or admin.",
      "Sermons can also be saved as drafts before publishing, with the same Drafts view.",
      "Renamed a song's \"Full Mix Track\" link to \"Split Track,\" and added a new \"Demo\" link slot for songs.",
      "Audio tracks (voice parts, Split Track, Demo) now play with a real, app-styled player instead of Google Drive's own embedded player — streamed through the app's own server for reliability (requires a one-time GOOGLE_DRIVE_API_KEY setup; falls back to Google's player automatically if that's not configured). Tapping a song's link still opens full-screen right in the app instead of leaving to Drive — works the same in Songs and inside a Program's songs. A playing track keeps playing if you switch over to view the Lyrics or Sheet Music at the same time, and forward/back buttons let you skip between a song's voice parts (when it has more than one) without picking each one from the list. Fixed: once you opened Lyrics or another pdf, there was no way to close it and get back to just the audio — tapping the same pdf button again now toggles it off.",
      "Setlists now show the same media links (Lyrics, Sheet Music, voice parts, Split Track, Demo) as Songs — tap one from within a setlist to open the same full-screen player/viewer; closing it takes you right back to the setlist.",
      "Sheet Music, Lyrics, and Chords can now be Word documents (.docx), not just PDFs.",
      "Fixed a link not working when it was copied from Drive's \"open as Google Docs\" view of an uploaded Word file, instead of the regular share link — both now work.",
      "Added a \"Notify\" checkbox to News, Sermons, Events, Setlists, and Prayer requests — checked by default (nothing changes unless you touch it), but you can now uncheck it to post something without pinging everyone, like adding next week's setlist.",
      "Sermons can now be organized into a Series, with part numbers and a filter to browse by series; series can also be edited or deleted.",
      "Sermons can now be edited after posting, not just deleted and re-added.",
      "Added a Send Feedback option in Settings, with an admin queue to review and resolve it.",
      "Added Curriculum: an optional module for class-type ministries to upload and share PDF materials.",
      "Added a Search tab in Bible — search passages, your notes and tags, and the dictionary all in one place.",
      "Today now shows a 30-day history strip alongside your reading streak.",
    ],
  },
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
