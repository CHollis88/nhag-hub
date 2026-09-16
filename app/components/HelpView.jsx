"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "How do I sign in?",
    a: "Type your username and PIN right on the sign-in screen — that's the normal way in, every time, on any device. The first time you ever use the app, or if you forget your PIN, tap \"First time here, or forgot your PIN?\" to get an email link instead, which either sets you up or lets you set a new PIN.",
  },
  {
    q: "What do the tabs at the bottom do?",
    a: "Home is where you see the ministries you're part of, and browse or request joining others. Bible is the full study suite. News, Events, Calendar, and Sermons show church-wide content — Calendar pulls together everything from church-wide Events plus every ministry you're actually in, color-coded so you can tell at a glance where each thing is coming from.",
  },
  {
    q: "How do I join a ministry?",
    a: "From the Home tab, tap a ministry under \"Other ministries\" to see what it's about — its description and who leads it — then tap \"Request to Join\" from there. That ministry's leader (or a Church Admin) will need to approve it before you're fully in. While you're waiting, that ministry's card shows \"Pending\" instead of \"Join,\" so you always know where a request stands.",
  },
  {
    q: "What happens when I tap \"Launch\" on a ministry?",
    a: "You enter that ministry's own space, with its own News, Events, Prayer, and Roster — separate from the church-wide ones. Some ministries have extra tabs too: a Song library and Setlists, a Programs tab for organizing things like a seasonal cantata or special production (each program gets its own Songs, Setlist, and Documents), or a Bible Plan bolt-on with Today, Plan, and Journal, leading the list. Tap \"← Home\" at the top to leave and go back.",
  },
  {
    q: "Can I leave a ministry?",
    a: "Yes — any member, leader included, can leave a ministry on their own from that ministry's Roster tab, no approval needed. You'll lose access to its News, Events, and Prayer right away, and would need to request to join again later if you change your mind.",
  },
  {
    q: "Who can post, edit, or delete News, Events, or Prayer requests?",
    a: "Posting News or Events in a ministry is limited to that ministry's leaders or a Church Admin — and the same people can edit or delete a post afterward if something needs fixing or removing. Prayer requests work differently: anyone in the group can submit one, and only the person who wrote it can edit it, though a leader or admin can still remove one if needed.",
  },
  {
    q: "What are \"Leaders Only\" posts?",
    a: "A way for leaders to share something meant for other leaders, not the general membership. Inside a ministry, any leader of that ministry can post a Leaders Only note that only that ministry's own leaders and admins can see — regular members won't know it's there. There's also a church-wide leaders channel in Church News: any active leader of any ministry (not just Church Admins) can post there, and it's visible to every ministry leader across the church, plus admins.",
  },
  {
    q: "Can I pin an announcement?",
    a: "Yes — a ministry's leaders (or a Church Admin for church-wide News) can pin a post to keep it at the top regardless of when it was posted, until it's unpinned. Useful for something that should stay visible for a while, like registration being open all month.",
  },
  {
    q: "Can I submit a prayer request?",
    a: "Yes — any member of a ministry can submit a prayer request to that ministry, and you can choose to submit it anonymously. Prayer requests don't have replies, but you can tap \"I'm praying\" to let the group know without posting a reply.",
  },
  {
    q: "Do events always have RSVP or replies?",
    a: "Not necessarily — whoever creates an event can choose whether RSVPs and replies are turned on for that specific event. Not every event needs a headcount or a discussion thread.",
  },
  {
    q: "What does \"Request to promote to church-wide\" do?",
    a: "It's a way for a ministry leader to ask a Church Admin to share one of their News posts on the church-wide News feed, so the whole church sees it — not just that ministry. The admin has to approve it first, and gets a notification when the request comes in.",
  },
  {
    q: "What's the Directory?",
    a: "A church-wide, searchable list of every ministry and its leaders, reachable from Home. Tap any ministry to see its description and who leads it. If you're a member, you'll also see its full roster; ministries you're not part of only show their leaders, to keep membership lists private to the people actually in them.",
  },
  {
    q: "Can a ministry change its own name, icon, color, or description?",
    a: "Yes — a ministry's own leaders (or a Church Admin) can rename it, change its type/category label, write a short description shown to people considering joining, upload an icon, and pick its tile color, all from inside that ministry's Roster tab.",
  },
  {
    q: "How does Bible Plan work, and can I pick which plan I'm on?",
    a: "Bible Plan is an optional bolt-on a ministry's leader can turn on, giving that ministry Today, Plan, and Journal tabs. There are four plans to choose from — the original year-long plan, Whole Bible in 6 or 9 months, and New Testament in 90 Days. A ministry's leader decides whether everyone follows one locked-in plan together, or each person picks their own. If you're a leader, you can also check the whole class's progress from the Roster tab. If notifications are on for a Bible Plan ministry, you'll also get a daily reading reminder.",
  },
  {
    q: "What is Programs, and how does it work?",
    a: "Programs is another optional bolt-on a ministry's leader can turn on — useful for organizing something like a seasonal cantata, a special production, or any project that needs its own Songs, Setlist, and Documents separate from the ministry's everyday ones. Each program shows up as its own card; tap one to open it. A program's Songs and Setlist are entirely its own library, not shared with the ministry's main Songs tab, so planning a special event never mixes into everyday repertoire. Documents lets a leader upload PDFs (sheet music, schedules, scripts) specific to that program. A ministry's leaders can create programs, and can hide a program that's finished or not ready yet — a hidden program just doesn't show up in the grid for regular members, though leaders and admins can still see and manage it.",
  },
  {
    q: "How does the Bible tab work?",
    sections: [
      {
        platform: "Reading",
        steps: [
          "Pick any book and chapter using the picker — the app remembers where you left off, and shows your recently viewed passages so you can jump back quickly",
          "Use the search bar to jump straight to a reference (like \"John 3:16\")",
          "Words with a dotted underline can be tapped to see their original Hebrew or Greek meaning",
        ],
      },
      {
        platform: "Selecting verses",
        steps: [
          "Tap a verse number to select it — a bar appears with what you can do with it",
          "Tap more verse numbers to extend your selection across a passage",
          "From that bar: see cross-references (listed in Bible order) and commentary, highlight, add a note, tag it, or copy the text",
        ],
      },
    ],
  },
  {
    q: "Is my Journal private?",
    a: "Yes. Only you can ever see your own Journal entries — there's no leader or admin view of anyone's journal, anywhere in the app. You can export your own Journal as a text file from the Journal tab any time.",
  },
  {
    q: "How do notifications work?",
    a: "You can turn on push notifications for your device in Settings, then choose what you want to hear about: church-wide News, Events, and Sermons, and separately for each ministry you're in. Tap the bell icon in the header any time to see your full notification history, not just what came through as a push. Tabs with something new since you last checked them also show a small dot.",
  },
  {
    q: "Can I make the text bigger?",
    a: "Yes — Settings has a Text Size option with eight sizes, from Tiny to Maximum. Ministry tiles on Home automatically adjust how many fit per row based on your text size and screen width, so things never feel cramped.",
  },
  {
    q: "Can I edit my name or username?",
    a: "Yes — the Profile section at the top of Settings lets you change your display name and username any time. Usernames still need to be unique, same as when you first signed up.",
  },
  {
    q: "I'm a Church Admin — where's the Admin Toolbox?",
    a: "Tap the toolbox icon in the header (only Admins see it). From there you can create ministries, manage or delete any ministry, promote or remove other people's admin access, search the full user directory, and see a log of recent admin activity. You can also hide a ministry from the Directory and Home's \"other ministries\" list — and separately choose whether hiding it also cuts off access for people already in it, or just keeps new people from finding it. You can also hide the toolbox icon and toggle from your own view in Settings if you'd rather not see it day-to-day — that's just a personal display choice and never actually changes your access.",
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

export default function HelpView({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-[60]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-t-2xl w-full max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-serif text-xl text-ink m-0">Help &amp; FAQ</h2>
          <button onClick={onClose} className="text-2xl text-inkfaint leading-none">×</button>
        </div>
        {FAQS.map((item, i) => (
          <FaqItem key={i} item={item} />
        ))}
      </div>
    </div>
  );
}
