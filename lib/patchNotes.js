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
    version: "69.3.1",
    date: "2026-09-27",
    title: "Faster loading behind the scenes",
    items: [
      "Events and the Calendar now load with far fewer requests, so they open faster, especially with lots of recurring events.",
      "Every screen does less work checking who's signed in, which makes the whole app a little quicker.",
      "Fixed: the book summary could be missing from the Study Panel after an update.",
    ],
  },
  {
    version: "69.2.0",
    date: "2026-09-27",
    title: "Book introductions live in the Study Panel on computers",
    items: [
      "On a computer in Study mode, the \u201cAbout this book\u201d summary now sits in the Study Panel instead of above the text, so the chapter starts right at the top. Tap \u201cRead the full introduction\u201d there to open the whole introduction in the reading area.",
    ],
  },
  {
    version: "69.1.0",
    date: "2026-09-27",
    title: "Study Panel upgrades and fixes",
    items: [
      "\u201cRead the full introduction\u201d now opens the book\u2019s introduction right in the reading area, with room to read it properly. A button at the bottom takes you back to the text.",
      "Theme notes open in the Study Panel on a computer, or a pop-up on a phone, with a button to jump to the passage they cover.",
      "On a computer in Study mode, the Study Panel is no longer blank before you tap something. It shows the book\u2019s summary, theme notes that start in the chapter you\u2019re reading, and the ones still running through it.",
      "Fixed: the introduction and theme links on the \u201cAbout this book\u201d card didn\u2019t open on a computer.",
      "Fixed: section and chapter titles could run into the first verse of some New Living Translation chapters, like Romans 1.",
    ],
  },
  {
    version: "69.0.0",
    date: "2026-09-27",
    title: "The Library, book introductions, and theme notes",
    items: [
      "The Bible tab has a new Library. Concordance and Glossary moved inside it, alongside new study helps, so everything for digging deeper is in one place.",
      "Book Introductions: background, setting, and a summary for all 66 books of the Bible.",
      "Theme Notes: nearly 300 short essays on the big ideas in Scripture, each tied to the passage it's about.",
      "Articles and Charts: over 100 in-depth articles and a set of reference charts, like Israel's feasts and festivals.",
      "Bible references inside any of these are tappable and take you straight to that passage.",
      "In Study mode, the first chapter of each book now opens with an \u201cAbout this book\u201d card, and theme notes appear where they begin. Switch to Simple to hide them.",
      "The Study / Simple switch now shows on every translation, not just the King James and Berean Standard Bible, and your choice carries across all of them.",
      "Tyndale's dictionary now works in Concordance's Browse view, and Tyndale's theme notes are searchable there too.",
      "Fixed: tapping for cross-references could crash the page and ask you to reload.",
      "Fixed: highlights could briefly show on the wrong words right after switching translations.",
      "Fixed: single-chapter books (Obadiah, Philemon, 2 John, 3 John, Jude) showed only their first verse in the ESV.",
      "Fixed: study notes covering a long section showed a confusing \u201cVerses 1-999\u201d label. They now show the real range.",
    ],
  },
  {
    version: "68.0.0",
    date: "2026-09-27",
    title: "Four translations, two commentaries, and a much bigger dictionary",
    items: [
      "Added three Bible translations alongside the King James Version: the English Standard Version (ESV), the New Living Translation (NLT), and the Berean Standard Bible (BSB). Tap the translation button above the text to switch.",
      "You can read a new translation on its own, or tap the KJV button to show it side by side with the King James \u2014 handy for comparing wording on a passage you know well. On a phone the two stack; on a wider screen they sit next to each other.",
      "Your translation choice is remembered, so the Bible tab opens where you left off.",
      "Highlights are kept separately for each translation. A phrase you highlight in the ESV stays highlighted in the ESV, and your existing King James highlights are untouched \u2014 the translations word verses differently, so a highlight can\u2019t simply move between them.",
      "Notes and tags work the other way on purpose: they\u2019re attached to a verse, not to particular words, so they follow you whichever translation you\u2019re reading.",
      "Cross-references work in every translation \u2014 tap a verse number and you\u2019ll get the related passages whichever one you\u2019re reading, since they\u2019re keyed to the verse rather than to particular words.",
      "Word study (the underlined words) now also works in the Berean Standard Bible, not just the King James \u2014 the BSB carries its own Hebrew and Greek word tagging.",
      "On the ESV and NLT, which don\u2019t carry that word-by-word tagging, tap the verse number \u2014 it\u2019s underlined for exactly this reason \u2014 to see that verse\u2019s words as the King James renders it, with the same tap-for-meaning behavior.",
      "Bible commentary now comes from two sources, available on every translation. Tyndale\u2019s modern Study Notes are shown by default, since they read naturally no matter which translation you\u2019re in. Prefer Matthew Henry\u2019s classic commentary? Switch it from the Reading Layout menu \u2014 just know his commentary quotes King James wording specifically, so it won\u2019t always match what\u2019s on screen in another translation.",
      "Each translation now shows its own section headings \u2014 previously every translation showed the King James\u2019s section breaks, even where another translation divides the text differently.",
      "Where a translation marks the words of Christ, they\u2019re now shown in red \u2014 the King James, New Living Translation, and Berean Standard Bible all have this now. The ESV\u2019s source doesn\u2019t carry that markup yet.",
      "Translator footnotes and the King James\u2019s own marginal notes (the \u201cor, ...\u201d alternate readings) are now available on the King James, New Living Translation, and Berean Standard Bible \u2014 a small marker appears after a verse that has one; tap it to read the note.",
      "The Bible dictionary got much bigger: alongside Easton\u2019s, Smith\u2019s, Hitchcock\u2019s, Torrey\u2019s, and Webster\u2019s, Concordance now also searches the modern Tyndale Open Bible Dictionary \u2014 over 6,000 entries on people, places, and terms \u2014 plus a set of in-depth Tyndale theme articles for topical study.",
      "If a translation can\u2019t be reached (the publisher\u2019s service is down, or the day\u2019s limit has been hit), the reader shows the King James instead and tells you so, rather than leaving you with a blank page.",
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
