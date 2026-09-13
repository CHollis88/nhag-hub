"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "What do the tabs at the bottom do?",
    a: "News and Events show church-wide announcements and events that any Church Admin has posted. Home is where you go to see the ministries (Choir, Sunday School classes, and anything else) you're part of, and to browse and request joining others. Bible is the full study suite — read any book or chapter, look up commentary, cross-references, and more.",
  },
  {
    q: "How do I join a ministry?",
    a: "From the Home tab, browse the list under \"All ministries\" and tap \"Request to join.\" That group's leader (or a Church Admin) will need to approve it before you're fully in — you'll see \"pending approval\" until then.",
  },
  {
    q: "What happens when I tap \"Launch\" on a ministry?",
    a: "You enter that ministry's own space, with its own News, Events, Prayer, and Roster — separate from the church-wide ones. Some ministries have extra tabs too: Choir gets a Song library and Setlists, and reading-plan groups (like Young Adults) get a daily Reading Plan and private Journal. Tap \"← Home\" at the top to leave and go back.",
  },
  {
    q: "Who can post News or Events in a ministry?",
    a: "Only that ministry's leaders, or a Church Admin. Everyone in the ministry can reply to News and Event posts, though.",
  },
  {
    q: "Can I submit a prayer request?",
    a: "Yes — any member of a ministry can submit a prayer request to that ministry, and you can choose to submit it anonymously. Prayer requests don't have replies, by design.",
  },
  {
    q: "What does \"Request to promote to church-wide\" do?",
    a: "It's a way for a ministry leader to ask a Church Admin to share one of their News posts on the church-wide News feed, so the whole church sees it — not just that ministry. The admin has to approve it first.",
  },
  {
    q: "How does the Bible tab work?",
    sections: [
      {
        platform: "Reading",
        steps: [
          "Pick any book and chapter using the picker — the app remembers where you left off",
          "Use the search bar to jump straight to a reference (like \"John 3:16\")",
          "Words with a dotted underline can be tapped to see their original Hebrew or Greek meaning",
        ],
      },
      {
        platform: "Selecting verses",
        steps: [
          "Tap a verse number to select it — a bar appears with what you can do with it",
          "Tap more verse numbers to extend your selection across a passage",
          "From that bar: see cross-references and commentary, highlight, add a note, tag it, or copy the text",
        ],
      },
    ],
  },
  {
    q: "Is my Journal private?",
    a: "Yes. Only you can ever see your own Journal entries — there's no leader or admin view of anyone's journal, anywhere in the app.",
  },
  {
    q: "How do notifications work?",
    a: "You can turn on push notifications for your device in Settings, then choose what you want to hear about: church-wide News & Events, and separately for each ministry you're in. If a ministry has a daily Reading Plan, you'll also get a 9am reminder for it if notifications are on for that ministry.",
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
