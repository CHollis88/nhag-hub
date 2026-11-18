// v72 "Did you know?" tips: one at a time on Home (DidYouKnowCard), and
// all of them in Help & FAQ under "Tips". `go` says where "Show me" takes
// you: a tab name, or one of the special screens AppShell knows how to open.

export const TIPS = [
  { id: "church-prayer", icon: "Heart", title: "Church Prayer", body: "Share a prayer request with the whole church (anonymously if you like) and let people know you're praying for theirs. It's the tile next to your ministries.", go: "church-prayer" },
  { id: "photo", icon: "Camera", title: "Add your photo", body: "Your profile photo shows next to your name in your ministries, the Directory, and on what you post.", go: "profile" },
  { id: "verse", icon: "BookOpen", title: "Verse of the Day", body: "A new verse every day at the top of Home. Tap it to read the whole chapter, or share it with someone.", go: "home" },
  { id: "wordstudy", icon: "BookOpen", title: "Tap any underlined word in the Bible", body: "See its original Hebrew or Greek meaning, root word, and how it's translated elsewhere.", go: "bible" },
  { id: "verseactions", icon: "Highlighter", title: "Tap a verse number", body: "Highlight it, add a note, tag it, or see cross-references. Tap more verse numbers first to select a whole passage.", go: "bible" },
  { id: "translations", icon: "BookOpen", title: "Six Bible translations", body: "KJV, BSB, ESV, NLT, NKJV, and AMP. Tap the translation button above the text to switch.", go: "bible" },
  { id: "listen", icon: "Volume2", title: "Listen to Scripture", body: "Tap Listen to hear a whole chapter read aloud, or Word tap to hear one word at a time.", go: "bible" },
  { id: "search", icon: "Search", title: "Search the Bible", body: "Search any word or phrase in all six translations, plus your own notes and the Bible dictionaries.", go: "bible" },
  { id: "library", icon: "Search", title: "Explore the Library", body: "Book introductions, theme notes, articles, charts, and six Bible dictionaries, under Library in the Bible tab.", go: "bible" },
  { id: "glossary", icon: "Sparkles", title: "Read the Glossary", body: "Plain-language explanations of words like grace, salvation, and baptism, plus what we believe as a church. Under Library in the Bible tab.", go: "bible" },
  { id: "journal", icon: "NotebookPen", title: "Keep a Journal", body: "Write down prayers and what God is showing you. Your Journal is private to you.", go: "bible" },
  { id: "directory", icon: "Users", title: "The Directory", body: "Every ministry and who leads it, in one place. Tap a person to see their profile.", go: "directory" },
  { id: "events", icon: "CalendarDays", title: "RSVP to events", body: "Tap Yes, Maybe, or No on any event so leaders know who's coming.", go: "events" },
  { id: "sermons", icon: "Mic", title: "Catch up on sermons", body: "Recent messages are on the Sermons tab.", go: "sermons" },
  { id: "refresh", icon: "RefreshCw", title: "Pull down to refresh", body: "On a phone, pull the screen down from the top to refresh. Inside a ministry it refreshes that ministry.", go: null },
  { id: "simple", icon: "SlidersHorizontal", title: "Prefer fewer buttons?", body: "Turn on Simple mode in Settings: a shorter menu, bigger labels, and messages that stay on screen longer.", go: "settings" },
  { id: "notifications", icon: "Bell", title: "Choose your notifications", body: "In Settings (the gear) you choose exactly what you hear about, church-wide and for each ministry.", go: "settings" },
  { id: "help", icon: "HelpCircle", title: "Help is one tap away", body: "The ? button at the top answers most questions about the app.", go: "help" },
];
