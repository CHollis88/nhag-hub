"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Folder } from "lucide-react";

// General-member-facing categories, roughly in the order a new member
// would actually need them: getting the app on their phone first, then
// finding their way around, then what each piece does. Anything that's
// only relevant to a leader or Church Admin lives in its own "Leader
// Tools" category instead, broken into subfolders by the part of the
// app it's about -- so a regular member never has to wade through
// leader-only material to find their own answer, and a leader knows
// exactly which subfolder to open for the thing they're trying to do.
const CATEGORIES = [
  {
    title: "Getting Started",
    items: [
      {
        q: "How do I sign in?",
        a: "Type your username and PIN right on the sign-in screen — that's the normal way in, every time, on any device. The first time you ever use the app, or if you forget your PIN, tap \"First time here, or forgot your PIN?\" to get an email link instead, which either sets you up or lets you set a new PIN.",
      },
      {
        q: "How do I add this app to my Home Screen?",
        sections: [
          {
            platform: "iPhone or iPad (Safari)",
            steps: [
              "Open the app in Safari (not another browser — this only works from Safari on iOS)",
              "Tap the Share icon at the bottom of the screen (a square with an arrow pointing up)",
              "Scroll down the menu that appears and tap \"Add to Home Screen\"",
              "Tap \"Add\" in the top right",
            ],
          },
          {
            platform: "Android (Chrome)",
            steps: [
              "Open the app in Chrome",
              "Tap the three-dot menu icon in the top right",
              "Tap \"Add to Home screen\" (some phones show this as \"Install app\")",
              "Tap \"Add\" or \"Install\" to confirm",
            ],
          },
        ],
      },
      {
        q: "What do the tabs at the bottom do?",
        a: "Home is where you see the ministries you're part of, and browse or request joining others. Bible is the full study suite. News, Events, Calendar, and Sermons show church-wide content — Calendar pulls together everything from church-wide Events plus every ministry you're actually in, color-coded so you can tell at a glance where each thing is coming from.",
      },
      {
        q: "How do I join a ministry?",
        a: "From the Home tab, tap a ministry under \"Other ministries\" to see what it's about — its description and who leads it — then tap \"Request to Join\" from there. That ministry's leader (or a Church Admin) will need to approve it before you're fully in. While you're waiting, that ministry's card shows \"Pending\" instead of \"Join,\" so you always know where a request stands.",
      },
    ],
  },
  {
    title: "Ministries",
    items: [
      {
        q: "What happens when I tap a ministry to open it?",
        a: "You enter that ministry's own space, with its own News, Events, Prayer, and Roster — separate from the church-wide ones. Some ministries have extra tabs too: a Song library and Setlists, a Programs tab for organizing things like a seasonal cantata or special production, Messages for private conversation with that ministry's leaders, Chat for a shared conversation with the whole ministry, or a Bible Plan bolt-on with Today, Plan, and Journal. Tap \"← Home\" at the top to leave and go back.",
      },
      {
        q: "Can I leave a ministry?",
        a: "Yes — any member, leader included, can leave a ministry on their own from that ministry's Roster tab, no approval needed. You'll lose access to its News, Events, and Prayer right away, and would need to request to join again later if you change your mind.",
      },
      {
        q: "What's the Directory?",
        a: "A church-wide, searchable list of every ministry and its leaders, reachable from Home. Tap any ministry to see its description and who leads it. If you're a member, you'll also see its full roster; ministries you're not part of only show their leaders, to keep membership lists private to the people actually in them.",
      },
      {
        q: "What is Messages, and how do I message a leader?",
        a: "Messages is an optional bolt-on for private, one-to-one or small-group conversation with a ministry's own leader(s) — not a general chat. From the Messages tab, tap \"New,\" pick one or more leaders, and start typing. If you later message a different combination of leaders, that starts a brand-new conversation rather than adding to an old one. You can react to any message — long-press a message to see the options — and mute a conversation's notifications any time. Muting only turns off alerts; you'll still see how many new messages are waiting when you open the app.",
      },
      {
        q: "What is Chat, and who can see it?",
        a: "Chat is a shared conversation for the whole ministry, separate from Messages. Where it's turned on, you'll see a Members channel anyone active in the group can post and read in. If a ministry also has a Leaders Only channel turned on, only that ministry's leaders and Church Admins can see it — as a regular member, you won't see it or know it's there. Same reactions and mute behavior as Messages.",
      },
    ],
  },
  {
    title: "News, Events & Prayer",
    items: [
      {
        q: "Who can post News or Events?",
        a: "Posting News or Events in a ministry is limited to that ministry's leaders or a Church Admin. Prayer requests work differently: anyone in the group can submit one, and only the person who wrote it can edit it, though a leader or admin can still remove one if needed.",
      },
      {
        q: "Can I submit a prayer request?",
        a: "Yes — any member of a ministry can submit a prayer request to that ministry, and you can choose to submit it anonymously. Prayer requests don't have replies, but you can tap \"I'm praying\" to let the group know without posting a reply.",
      },
      {
        q: "Do events always have RSVP or replies?",
        a: "Not necessarily — whoever creates an event can choose whether RSVPs and replies are turned on for that specific event. Not every event needs a headcount or a discussion thread.",
      },
    ],
  },
  {
    title: "The Bible Tab",
    items: [
      {
        q: "How do I read and navigate a passage?",
        sections: [
          {
            platform: "Reading",
            steps: [
              "Pick any book and chapter using the picker — the app remembers where you left off, and shows your recently viewed passages so you can jump back quickly",
              "Use the search bar to jump straight to a reference (like \"John 3:16\")",
              "Words with a dotted underline can be tapped to see their original Hebrew or Greek meaning",
            ],
          },
        ],
      },
      {
        q: "How do highlighting, notes, and tags work?",
        sections: [
          {
            platform: "Selecting a verse or passage",
            steps: [
              "Tap a verse number to select it — a bar appears with what you can do with it",
              "Tap more verse numbers to extend your selection across a passage",
              "From that bar: see cross-references (listed in Bible order) and commentary, highlight it in a color of your choice, add a note, tag it, or copy the text",
            ],
          },
          {
            platform: "Finding it again later",
            steps: [
              "Open \"My Notes\" from the Bible tab to see every highlight, note, and tag you've made, all in one searchable place",
              "Tap any entry there to jump straight back to that passage",
            ],
          },
        ],
      },
      {
        q: "What are Concordance and Glossary for?",
        a: "Concordance lets you search for a specific word (like \"faith\") or a Strong's number (like \"G26\") and see every place it appears. Glossary is a lookup of theological and biblical terms — both are their own sections inside the Bible tab, next to Read and My Notes.",
      },
      {
        q: "How does Bible Plan work, and can I pick which plan I'm on?",
        a: "Bible Plan is an optional bolt-on some ministries turn on, giving that ministry Today, Plan, and Journal tabs. There are four plans to choose from — the original year-long plan, Whole Bible in 6 or 9 months, and New Testament in 90 Days. If notifications are on for a Bible Plan ministry, you'll also get a daily reading reminder.",
      },
      {
        q: "Is my Journal private?",
        a: "Yes. Only you can ever see your own Journal entries — there's no leader or admin view of anyone's journal, anywhere in the app. You can export your own Journal as a text file from the Journal tab any time.",
      },
    ],
  },
  {
    title: "Notifications & Settings",
    items: [
      {
        q: "How do notifications work?",
        a: "You can turn on push notifications for your device in Settings, then choose what you want to hear about: church-wide News, Events, and Sermons, and separately for each ministry you're in. Tap the bell icon in the header any time to see your full notification history, not just what came through as a push. Tabs with something new since you last checked them also show a small dot. Messages and Chat have their own mute switch inside each conversation — muting silences alerts for just that conversation, but you'll still see how many new messages are waiting the next time you open it.",
      },
      {
        q: "Can I make the text bigger?",
        a: "Yes — Settings has a Text Size option with eight sizes, from Tiny to Maximum.",
      },
      {
        q: "Can I edit my name or username?",
        a: "Yes — the Profile section at the top of Settings lets you change your display name and username any time. Usernames still need to be unique, same as when you first signed up.",
      },
    ],
  },
];

// Leader/admin-only material, grouped by the part of the app it's
// about. Kept entirely separate from the general categories above so a
// regular member never has to scroll past leader-only content to find
// their own answer.
const LEADER_SUBFOLDERS = [
  {
    title: "Posting & Announcements",
    items: [
      {
        q: "What are \"Leaders Only\" posts?",
        a: "A way for leaders to share something meant for other leaders, not the general membership. Inside a ministry, any leader of that ministry can post a Leaders Only note that only that ministry's own leaders and admins can see. There's also a church-wide leaders channel in Church News: any active leader of any ministry (not just Church Admins) can post there, visible to every ministry leader across the church, plus admins.",
      },
      {
        q: "Can I pin an announcement?",
        a: "Yes — a ministry's leaders (or a Church Admin for church-wide News) can pin a post to keep it at the top regardless of when it was posted, until it's unpinned. Useful for something that should stay visible for a while, like registration being open all month.",
      },
      {
        q: "What does \"Request to promote to church-wide\" do?",
        a: "It's a way for a ministry leader to ask a Church Admin to share one of their News posts on the church-wide News feed, so the whole church sees it — not just that ministry. The admin has to approve it first, and gets a notification when the request comes in.",
      },
      {
        q: "Can I edit or delete News, Events, or a member's Prayer request?",
        a: "Yes — a ministry's leaders (or a Church Admin) can edit or delete any News or Events post in that ministry. Prayer requests are the one exception: a leader can remove one if it needs to come down, but can't edit the wording of a member's own request.",
      },
    ],
  },
  {
    title: "Ministry Settings",
    items: [
      {
        q: "Can a ministry change its own name, icon, color, or description?",
        a: "Yes — a ministry's own leaders (or a Church Admin) can rename it, change its type/category label, write a short description shown to people considering joining, upload an icon, and pick its tile color, all from inside that ministry's Roster tab.",
      },
      {
        q: "How do I turn Programs, Messages, Chat, or Bible Plan on for my ministry?",
        a: "From that ministry's Roster tab, scroll to \"Bolt-on Modules\" — each one (Songs & Setlists, Bible Plan, Programs, Messages, and Chat's Members and Leaders Only channels) is its own checkbox, so you can turn on exactly the combination your ministry needs. Chat's two channels are independent: you can turn on just Leaders Only without opening a general Members channel, or the other way around.",
      },
      {
        q: "How do I approve someone who wants to join?",
        a: "Pending join requests show up right on that ministry's own Roster tab, for that ministry's leaders (or a Church Admin) to approve or decline.",
      },
    ],
  },
  {
    title: "Programs & Bible Plan",
    items: [
      {
        q: "How do I create or hide a Program?",
        a: "From the Programs tab (once it's turned on for your ministry), leaders can create a new program, which gets its own Songs, Setlist, and Documents — entirely separate from the ministry's everyday Songs tab, so planning a special event never mixes into everyday repertoire. A leader can also hide a program that's finished or not ready yet; it simply won't show up in the grid for regular members, though leaders and admins can still see and manage it.",
      },
      {
        q: "How do I check my class's Bible Plan progress?",
        a: "From that ministry's Roster tab, you'll see each member's current day and how far along they are in the plan. If you've locked the ministry to one shared plan, everyone's progress is easy to compare at a glance.",
      },
    ],
  },
  {
    title: "Admin Toolbox",
    items: [
      {
        q: "Where's the Admin Toolbox, and what can I do from it?",
        a: "Tap the toolbox icon in the header (only Church Admins see it). From there you can create ministries, manage or delete any ministry, promote or remove other people's admin access, search the full user directory, and see a log of recent admin activity.",
      },
      {
        q: "How do I hide a ministry, or block it for one specific person?",
        a: "From the Toolbox, you can hide a ministry from the Directory and Home's \"other ministries\" list — and separately choose whether hiding it also cuts off access for people already in it, or just keeps new people from finding it. \"Block ministries\" next to any user lets you go further and block specific ministries for just that one person — useful if someone shouldn't be discovering or joining certain ministries at all; it removes their membership immediately if they're already in one.",
      },
      {
        q: "How do I set up an account for someone without an email address?",
        a: "From the Toolbox's \"Set up an account without email\" section, choose their username and PIN directly — they sign in with just those two, no email step ever involved. Good for a member who can't manage email on their own but can still tap in a PIN on their own device.",
      },
      {
        q: "Can I hide the Toolbox icon from my own view?",
        a: "Yes — there's a toggle in Settings for this. It's purely a personal display choice and never actually changes your access; it's just there so the icon isn't cluttering your header day-to-day if you'd rather open the Toolbox less often.",
      },
    ],
  },
];

function FaqItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-linesoft py-3">
      <button onClick={() => setOpen(!open)} className="w-full text-left font-semibold text-[0.9375rem] text-ink">
        {item.q}
      </button>
      {open && (
        <div className="mt-2 text-sm text-inksoft">
          {item.a && <p>{item.a}</p>}
          {item.sections?.map((s) => (
            <div key={s.platform} className="mb-2.5">
              <strong className="text-ink">{s.platform}</strong>
              <ul className="mt-1 list-disc pl-5">
                {s.steps.map((step, i) => (
                  <li key={i} className="mb-1">{step}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Category({ category, defaultOpen }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 text-left font-serif text-lg text-ink py-2"
      >
        {open ? <ChevronDown size={18} className="text-inkfaint flex-shrink-0" /> : <ChevronRight size={18} className="text-inkfaint flex-shrink-0" />}
        {category.title}
      </button>
      {open && (
        <div className="pl-1">
          {category.items?.map((item, i) => <FaqItem key={i} item={item} />)}
          {category.subfolders?.map((sub, i) => <Subfolder key={i} subfolder={sub} />)}
        </div>
      )}
    </div>
  );
}

function Subfolder({ subfolder }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-1 ml-2 border-l-2 border-linesoft pl-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 text-left text-sm font-semibold text-inksoft py-2"
      >
        <Folder size={15} className="text-inkfaint flex-shrink-0" />
        {subfolder.title}
        {open ? <ChevronDown size={14} className="text-inkfaint ml-auto" /> : <ChevronRight size={14} className="text-inkfaint ml-auto" />}
      </button>
      {open && (
        <div className="pl-1">
          {subfolder.items.map((item, i) => <FaqItem key={i} item={item} />)}
        </div>
      )}
    </div>
  );
}

export default function HelpView({ onClose, isLeader }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-[60]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-t-2xl w-full max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex justify-between items-center mb-2 gap-2">
          <h2 className="font-serif text-xl text-ink m-0 min-w-0 truncate">Help &amp; FAQ</h2>
          <button onClick={onClose} className="text-2xl text-inkfaint leading-none flex-shrink-0">×</button>
        </div>
        {CATEGORIES.map((cat, i) => (
          <Category key={i} category={cat} defaultOpen={i === 0} />
        ))}
        {isLeader && (
          <Category category={{ title: "Leader Tools", subfolders: LEADER_SUBFOLDERS }} />
        )}
      </div>
    </div>
  );
}
