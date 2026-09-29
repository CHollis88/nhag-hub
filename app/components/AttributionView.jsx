"use client";

import Modal from "./Modal";

const SOURCES = [
  {
    category: "Bible Text",
    items: [
      {
        name: "King James Version (KJV)",
        detail: "First published 1611; the text used here follows the 1769 Oxford standardization. Public domain.",
      },
    ],
  },
  {
    category: "Original Language Study",
    items: [
      {
        name: "Strong's Exhaustive Concordance",
        detail: "James Strong, 1890. Strong's numbering, definitions, and word outlines. Public domain.",
      },
      {
        name: "Blue Letter Bible Hebrew & Greek Lexicons",
        detail: "Supplementary lexical data, including TWOT/TDNT reference numbers and root-word relationships, used to enrich word-study detail alongside Strong's.",
      },
      {
        name: "STEPBible data",
        detail: "Open Hebrew and Greek interlinear data, used to fill gaps in lexicon coverage not present in the original Strong's material.",
      },
    ],
  },
  {
    category: "Commentary",
    items: [
      { name: "Matthew Henry's Concise Commentary", detail: "Matthew Henry (1662–1714). Public domain." },
      {
        name: "Tyndale Open Study Notes",
        detail: "Study notes, book introductions, and theme notes. © Tyndale House Publishers. Used under CC BY-SA 4.0 (creativecommons.org/licenses/by-sa/4.0).",
      },
    ],
  },
  {
    category: "Dictionaries",
    items: [
      { name: "Easton's Bible Dictionary", detail: "Matthew George Easton, 1897. Public domain." },
      { name: "Smith's Bible Dictionary", detail: "William Smith, 1863. Public domain." },
      { name: "Hitchcock's Bible Names Dictionary", detail: "Roswell D. Hitchcock, 1869. Public domain." },
      { name: "Torrey's Topical Textbook", detail: "R. A. Torrey, 1897. Public domain." },
      { name: "Webster's 1828 Dictionary", detail: "Noah Webster, 1828. Used for archaic KJV word meanings. Public domain." },
      {
        name: "Tyndale Open Bible Dictionary",
        detail: "Dictionary entries, articles, and charts. © Tyndale House Publishers. Used under CC BY-SA 4.0 (creativecommons.org/licenses/by-sa/4.0).",
      },
    ],
  },
  {
    category: "Structure & Reference Data",
    items: [
      { name: "Section headings (pericopes)", detail: "Passage groupings used to display section headings inline while reading." },
    ],
  },
  {
    category: "Original to This App",
    items: [
      { name: "Christian Glossary", detail: "Plain-language term definitions written specifically for this app." },
    ],
  },
];

export default function AttributionView({ onClose }) {
  return (
    <Modal title="Sources & Attribution" onClose={onClose} z={60} maxHeight="85vh">
      <p className="text-sm text-inksoft leading-relaxed mb-5">
        The Bible study tools in this app draw on the historic public-domain reference works
        listed below, plus a small amount of original content written for this app. None of
        this material is required to be credited, but we want to be transparent about where
        everything comes from.
      </p>

      <div className="space-y-5">
        {SOURCES.map((s) => (
          <div key={s.category}>
            <p className="text-xs uppercase tracking-wide text-inkfaint mb-2">{s.category}</p>
            <div className="space-y-2">
              {s.items.map((item) => (
                <div key={item.name} className="sp-card">
                  <p className="text-sm font-semibold text-ink mb-1">{item.name}</p>
                  <p className="text-xs text-inksoft leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-inkfaint leading-relaxed mt-5 pt-4 border-t border-linesoft">
        If you notice an attribution that's missing or needs correcting, please let a leader know so it can be fixed.
      </p>
    </Modal>
  );
}
