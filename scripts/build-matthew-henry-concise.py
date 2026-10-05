#!/usr/bin/env python3
"""Rebuild data/bible/matthew-henry-concise.json from the e-Sword MHCC module.

Usage:  python3 scripts/build-matthew-henry-concise.py /path/to/Matthew_Henry_Concise_Commentary.cmti

Source: "Matthew Henry's Concise Commentary" (e-Sword .cmti, a SQLite file). The
module states the work is in the public domain. Output keeps the app's existing
shape -- { "Gen|1": [ { "v1": 1, "v2": 2, "text": "..." }, ... ] } -- with NO
length cap (the previous import clipped every note near 2,000 characters and
dropped 140 chapters).

The module attaches every note to its FIRST verse only (VerseEnd == VerseBegin for
all 4,053 rows), but each note actually covers a passage ("Verses 3-5"). So the
range is rebuilt as: from this note's first verse up to the verse before the next
note starts; the last note in a chapter runs to the chapter's last verse (from the
KJV data). Checked against the previous data, this reproduces its ranges.

Cleaning done to the module's text:
  * strip the HTML wrapper (div/p/br/u)
  * scripture references arrive as escaped <reflink target="1Jo_5:20">1Jo_5:20</reflink>
    tags; keep just the visible reference, with "_" -> " "
  * curly quotes arrive as the literal text \\u8220? / \\u8221?; restore them
"""
import sqlite3, re, json, html, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

def book_abbrs():
    src = open(os.path.join(ROOT, "lib", "bible.js"), encoding="utf-8").read()
    blk = src[src.index("export const BOOKS = ["):]
    blk = blk[: blk.index("];")]
    abbrs = re.findall(r'\["(\w{3})",', blk)
    assert len(abbrs) == 66, f"expected 66 books, found {len(abbrs)}"
    return abbrs

def last_verse(abbr, chapter):
    """Last verse number of a chapter, from the KJV data (None if unavailable)."""
    try:
        d = json.load(open(os.path.join(ROOT, "data", "bible", "kjv", f"{abbr}.json"), encoding="utf-8"))
        return max(int(v) for v in d["chapters"][str(chapter)])
    except Exception:
        return None

def clean(raw):
    t = raw or ""
    t = re.sub(r"<br\s*/?>", " ", t)
    t = t.replace("</p>", " ")
    t = re.sub(r"<[^>]+>", "", t)          # real tags only; reflinks are still escaped here
    t = html.unescape(t)                    # now the reflink tags are visible
    t = re.sub(r"<reflink[^>]*>(.*?)</reflink>", lambda m: m.group(1).replace("_", " "), t, flags=re.S)
    t = re.sub(r"<[^>]+>", "", t)           # any stray leftovers
    t = t.replace("\\u8220?", "\u201c").replace("\\u8221?", "\u201d")
    return re.sub(r"\s+", " ", t).strip()

def main(path):
    abbrs = book_abbrs()
    db = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    out = {}
    for book, c1, v1, c2, v2, text in db.execute(
        "select Book,ChapterBegin,VerseBegin,ChapterEnd,VerseEnd,Comments from VerseCommentary "
        "order by Book,ChapterBegin,VerseBegin"
    ):
        body = clean(text)
        if not body:
            continue
        assert c1 == c2, f"chapter-spanning note at book {book} {c1}:{v1}"  # none exist in this module
        out.setdefault(f"{abbrs[book-1]}|{c1}", []).append({"v1": v1, "v2": v1, "text": body})
    # Rebuild each note's end verse (see the module docstring).
    for key, notes in out.items():
        abbr, ch = key.split("|")
        notes.sort(key=lambda n: n["v1"])
        for i, n in enumerate(notes):
            if i + 1 < len(notes):
                n["v2"] = max(n["v1"], notes[i + 1]["v1"] - 1)
            else:
                n["v2"] = max(n["v1"], last_verse(abbr, ch) or n["v1"])
    dest = os.path.join(ROOT, "data", "bible", "matthew-henry-concise.json")
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {dest}: {len(out)} chapters, {sum(len(v) for v in out.values())} notes")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "Matthew_Henry_Concise_Commentary.cmti")
