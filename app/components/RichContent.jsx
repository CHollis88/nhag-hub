"use client";

import { formatReference } from "@/lib/bibleRef";

// Renders the structured "blocks" produced by
// scripts/build-tyndale-library.py. No HTML from the source is ever
// injected -- every run is rendered as React text, so there's nothing
// to sanitize. Bible references become buttons that call onRef with an
// "Abbr ch:v" string (the same format PassageReader.goToReference and
// the cross-reference list already use).

function Runs({ runs, onRef }) {
  return runs.map((r, i) => {
    let node = r.t;
    if (r.sc) node = <span style={{ fontVariant: "small-caps" }}>{node}</span>;
    if (r.i) node = <em>{node}</em>;
    if (r.b) node = <strong className="font-semibold text-ink">{node}</strong>;
    if (r.ref && onRef) {
      return (
        <button
          key={i}
          type="button"
          onClick={() => onRef(r.ref)}
          className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          title={`Open ${formatReference(r.ref)}`}
        >
          {node}
        </button>
      );
    }
    return <span key={i}>{node}</span>;
  });
}

export default function RichContent({ blocks, onRef }) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        if (b.k === "h") {
          return (
            <p key={i} className="font-serif text-base text-ink font-semibold pt-2">
              <Runs runs={b.r} onRef={onRef} />
            </p>
          );
        }
        if (b.k === "li") {
          return (
            <p key={i} className="text-sm text-inksoft leading-relaxed pl-4">
              <Runs runs={b.r} onRef={onRef} />
            </p>
          );
        }
        if (b.k === "q") {
          return (
            <p key={i} className="text-sm text-inksoft leading-relaxed pl-3 border-l-2 border-line">
              <Runs runs={b.r} onRef={onRef} />
            </p>
          );
        }
        if (b.k === "table") {
          return (
            <div key={i} className="overflow-x-auto -mx-1 px-1">
              <table className="text-xs text-inksoft border-collapse min-w-full">
                <tbody>
                  {b.rows.map((row, ri) => (
                    <tr key={ri} className={ri === 0 ? "bg-accent/5" : "border-t border-linesoft"}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="align-top px-2 py-1.5 leading-snug min-w-[7rem]">
                          <Runs runs={cell} onRef={onRef} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm text-inksoft leading-relaxed">
            <Runs runs={b.r} onRef={onRef} />
          </p>
        );
      })}
    </div>
  );
}

export function TyndaleAttribution({ source = "Tyndale Open Study Notes" }) {
  return (
    <p className="text-[0.625rem] text-inkfaint mt-4">
      {source}, © Tyndale House Publishers. Used under{" "}
      <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" className="underline">
        CC BY-SA 4.0
      </a>
      .
    </p>
  );
}
