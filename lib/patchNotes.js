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
    version: "70.2.0",
    date: "2026-09-27",
    title: "Four Bible translations, a new Library, and study tools for every passage",
    items: [
      "The Bible now has four translations: the King James Version, plus the English Standard Version (ESV), the New Living Translation (NLT), and the Berean Standard Bible (BSB). Tap the translation button above the text to switch, and your choice is remembered.",
      "Read a translation on its own, or tap the KJV button to see it side by side with the King James. On a phone the two stack; on a wider screen they sit next to each other.",
      "Highlights are kept separately for each translation, since each one words a verse differently. Notes and tags are attached to the verse itself, so they follow you whichever translation you're reading.",
      "Cross-references, commentary, and footnotes work in every translation.",
      "Where a translation marks the words of Christ, they're shown in red (King James, NLT, and BSB).",
      "Each translation shows its own section headings. Psalm titles like \u201cA Psalm of David\u201d now appear on their own line above the psalm, in every translation, instead of running into the first verse. Psalm 119\u2019s Hebrew letter headings (Aleph, Beth, and so on) are shown the same way.",
      "Word study (the underlined words) works in the King James and the Berean Standard Bible. On the ESV and NLT, tap a verse number to see its words as the King James renders them, with the same tap-for-meaning behavior.",
      "The Study / Simple switch now appears on every translation, and your choice carries across all of them. Simple hides the study extras for plain reading.",
      "Bible commentary now comes from two sources. Tyndale's modern Study Notes are shown by default and read naturally in any translation. Prefer Matthew Henry's classic commentary? Switch it from the Reading Layout menu.",
      "The Bible tab has a new Library, where every study help now lives: Book Introductions, Theme Notes, Articles, Charts, Dictionaries & Concordance, Original Languages, and the Glossary with What We Believe.",
      "Book Introductions: background, setting, and a summary for all 66 books of the Bible.",
      "Theme Notes: nearly 300 short essays on the big ideas in Scripture, each tied to the passage it's about.",
      "Articles and Charts: over 100 in-depth articles, plus reference charts like Israel's feasts and festivals.",
      "Dictionaries & Concordance now includes the modern Tyndale Open Bible Dictionary, with over 6,000 entries, alongside Easton's, Smith's, Hitchcock's, Torrey's, and Webster's.",
      "Original Languages: search an English word like \u201clove\u201d to find the Hebrew and Greek words behind it, or look up a Strong's number directly.",
      "Bible references inside any Library item are tappable and take you straight to that passage.",
      "In Study mode, the first chapter of each book opens with an \u201cAbout this book\u201d card, and theme notes appear where they begin. On a computer, these live in the Study Panel beside the text, which shows the book's summary and the chapter's theme notes before you tap anything.",
      "\u201cRead the full introduction\u201d opens a book's introduction right in the reading area, with a button to take you back to the text.",
      "My Notes shows highlights from every translation, labeled with the translation they were made in, and refreshes when you come back to the app. If something can't load, it now says so and offers a Try Again button.",
      "Fixed: opening a passage from a reading plan now lets you scroll through the whole chapter.",
      "Fixed: a few leftover source marks in the King James text, like \u201c[fn]\u201d after some verses and brackets around Psalm titles.",
      "Commas no longer have a stray space in front of them.",
      "If a translation can't be reached, the reader shows the King James instead and tells you so, rather than leaving a blank page.",
      "Events and the Calendar load faster, and the whole app does less work behind the scenes on every screen.",
    ],
  },
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
