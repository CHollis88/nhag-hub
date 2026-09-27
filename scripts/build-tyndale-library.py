# Tyndale Open Study Notes + Open Bible Dictionary -> Library JSON
#
# Produces four files in data/bible/:
#   tyndale-book-intros.json   { "Gen": { title, summary: [{label, value}], blocks } }
#   tyndale-theme-notes.json   [ { id, title, ref: {book, c1, v1, c2, v2}, blocks } ]
#   tyndale-articles.json      [ { id, title, blocks } ]   (Dictionary "Textboxes")
#   tyndale-charts.json        [ { id, title, blocks } ]   (includes tables)
#
# CC BY-SA 4.0, Tyndale House Publishers. Maps and Pictures are
# deliberately NOT built: maps are 80 PDFs (too heavy for the free
# Supabase tier), and the Pictures package ships references only, no
# image files.
#
# Content shape ("blocks") -- rendered by app/components/RichContent.jsx:
#   { k: "h" | "p" | "li" | "q", r: [runs] }
#   { k: "table", rows: [[ [runs], [runs] ], ...] }
# A run is { t, i?, b?, sc?, ref? } -- ref is "Abbr ch:v" (the same
# format PassageReader.goToReference already parses), so any Bible
# reference inside Tyndale's text becomes tappable.
#
# Usage: python3 scripts/build-tyndale-library.py <StudyNotesDir> <DictionaryDir> <outDir>

import json
import re
import sys
import xml.etree.ElementTree as ET

NOTES_DIR, DICT_DIR, OUT_DIR = sys.argv[1], sys.argv[2], sys.argv[3]

# Tyndale's book codes -> this app's abbreviations. Tyndale uses two
# conventions: Roman-numeral prefixes in item names (ISam) and Arabic
# ones inside references (1Sam), so both are generated from one table.
BASE = {
    "Gen": "Gen", "Exod": "Exo", "Lev": "Lev", "Num": "Num", "Deut": "Deu",
    "Josh": "Jos", "Judg": "Jdg", "Ruth": "Rth", "Sam": "Sa", "Kgs": "Ki",
    "Chr": "Ch", "Ezra": "Ezr", "Neh": "Neh", "Esth": "Est", "Job": "Job",
    "Ps": "Psa", "Pr": "Pro", "Prov": "Pro", "Eccl": "Ecc", "Song": "Sng",
    "Isa": "Isa", "Jer": "Jer", "Lam": "Lam", "Ezek": "Eze", "Dan": "Dan",
    "Hos": "Hos", "Joel": "Joe", "Amos": "Amo", "Obad": "Oba", "Jon": "Jon",
    "Jonah": "Jon", "Mic": "Mic", "Nah": "Nah", "Hab": "Hab", "Zeph": "Zep",
    "Hag": "Hag", "Hagg": "Hag", "Zech": "Zec", "Mal": "Mal",
    "Matt": "Mat", "Mark": "Mar", "Luke": "Luk", "John": "Jhn", "Acts": "Act",
    "Rom": "Rom", "Cor": "Co", "Gal": "Gal", "Eph": "Eph", "Phil": "Phl",
    "Col": "Col", "Thes": "Th", "Thess": "Th", "Tim": "Ti", "Titus": "Tit",
    "Phlm": "Phm", "Heb": "Heb", "Jas": "Jas", "Pet": "Pe", "Jn": "Jo",
    "Jude": "Jde", "Rev": "Rev",
}
NUMBERED = {"Sam", "Kgs", "Chr", "Cor", "Thes", "Thess", "Tim", "Pet", "Jn"}

def to_app(code):
    # Try the code as-is first: "Isa" must not be read as "I" + "sa".
    if code in BASE and code not in NUMBERED:
        return BASE[code]
    m = re.match(r"^(I{1,3}|[1-3])?([A-Za-z]+)$", code)
    if not m:
        return None
    prefix, base = m.groups()
    if base not in BASE:
        return None
    if base in NUMBERED:
        if not prefix:
            return None
        n = {"I": "1", "II": "2", "III": "3"}.get(prefix, prefix)
        return n + BASE[base]
    return None if prefix else BASE[base]

REF_RE = re.compile(r"^([1-3I]*[A-Za-z]+)\.(\d+)(?:\.(\d+))?")

def bref_to_ref(href):
    m = re.match(r"^\?bref=(.+)$", href or "")
    if not m:
        return None
    r = REF_RE.match(m.group(1))
    if not r:
        return None
    abbr = to_app(r.group(1))
    if not abbr:
        return None  # e.g. Apocrypha (1Macc) -- shown as plain text
    return f"{abbr} {r.group(2)}:{r.group(3) or 1}"

def parse_range(refs):
    """'Gen.1.1-2.25' -> {book, c1, v1, c2, v2}"""
    m = re.match(r"^([1-3I]*[A-Za-z]+)\.(\d+)\.(\d+)(?:-(?:(\d+)\.)?(\d+))?", refs or "")
    if not m:
        return None
    abbr = to_app(m.group(1))
    if not abbr:
        return None
    c1, v1 = int(m.group(2)), int(m.group(3))
    c2 = int(m.group(4)) if m.group(4) else c1
    v2 = int(m.group(5)) if m.group(5) else v1
    return {"book": abbr, "c1": c1, "v1": v1, "c2": c2, "v2": v2}

ITAL = {"ital", "hebrew", "greek", "latin", "apocrypha", "divine-name-ital"}
BOLD = {"bold", "bold-era", "intro-h2", "intro-h2-era"}
SMALLCAPS = {"sc", "divine-name", "era", "bold-era", "intro-h2-era", "ital-bold-sc"}

def runs_of(el, fmt=None):
    fmt = dict(fmt or {})
    out = []

    def add(text, f, ref=None):
        if not text:
            return
        run = {"t": text}
        if f.get("i"): run["i"] = 1
        if f.get("b"): run["b"] = 1
        if f.get("sc"): run["sc"] = 1
        if ref: run["ref"] = ref
        # merge with previous run of identical formatting
        if out and {k: v for k, v in out[-1].items() if k != "t"} == {k: v for k, v in run.items() if k != "t"}:
            out[-1]["t"] += text
        else:
            out.append(run)

    def walk(node, f, ref=None):
        add(node.text, f, ref)
        for child in node:
            cf = dict(f)
            cref = ref
            cls = child.get("class", "")
            if child.tag == "span":
                if cls in ITAL or "ital" in cls: cf["i"] = True
                if cls in BOLD or "bold" in cls: cf["b"] = True
                if cls in SMALLCAPS: cf["sc"] = True
                if cls == "sup" or cls == "ital-super":
                    add(child.tail, f, ref)
                    continue  # footnote-style superscripts: drop
            elif child.tag == "a":
                cref = bref_to_ref(child.get("href"))
            walk(child, cf, cref)
            add(child.tail, f, ref)

    walk(el, fmt)
    # normalise whitespace
    for r in out:
        r["t"] = re.sub(r"\s+", " ", r["t"])
    if out:
        out[0]["t"] = out[0]["t"].lstrip()
        out[-1]["t"] = out[-1]["t"].rstrip()
    return [r for r in out if r["t"]]

def kind_of(cls):
    if re.search(r"(^|-)h[1-5]($|-)", cls) or cls.endswith("-title"):
        return "h"
    if "list" in cls:
        return "li"
    if "extract" in cls or "poetry" in cls:
        return "q"
    return "p"

def blocks_of(body, skip_title=None):
    blocks = []
    for child in body:
        if child.tag == "p":
            cls = child.get("class", "")
            if cls == "artfile":
                continue
            runs = runs_of(child)
            if not runs:
                continue
            k = kind_of(cls)
            text = "".join(r["t"] for r in runs).strip()
            if k == "h" and skip_title and not blocks and text.lower() in (skip_title.lower(), f"the book of {skip_title}".lower()):
                continue  # the item's own title restated
            blocks.append({"k": k, "r": runs})
        elif child.tag == "table":
            rows = []
            for tr in child.findall("tr"):
                cells = []
                for td in tr.findall("td"):
                    cell = []
                    for p in td.findall("p"):
                        if cell:
                            cell.append({"t": " "})
                        cell.extend(runs_of(p))
                    cells.append(cell)
                rows.append(cells)
            if rows:
                blocks.append({"k": "table", "rows": rows})
    return blocks

def items(path):
    return ET.parse(path).getroot().findall("item")

def slug(name):
    return re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-").lower()

# ── Book intros + summaries ─────────────────────────────────────────────
intros = {}
for it in items(f"{NOTES_DIR}/BookIntros.xml"):
    rng = parse_range(it.findtext("refs"))
    if not rng:
        continue
    title = it.findtext("title")
    intros[rng["book"]] = {"title": title, "summary": [], "blocks": blocks_of(it.find("body"), title)}

for it in items(f"{NOTES_DIR}/BookIntroSummaries.xml"):
    rng = parse_range(it.findtext("refs"))
    if not rng or rng["book"] not in intros:
        continue
    summary, label = [], None
    for p in it.find("body").findall("p"):
        cls = p.get("class", "")
        text = "".join(r["t"] for r in runs_of(p)).strip()
        if cls == "intro-sidebar-h1":
            label = text
        elif label and text:
            summary.append({"label": label, "value": text})
            label = None
    intros[rng["book"]]["summary"] = summary

# ── Theme notes ────────────────────────────────────────────────────────
themes = []
for it in items(f"{NOTES_DIR}/ThemeNotes.xml"):
    title = it.findtext("title")
    rng = parse_range(it.findtext("refs"))
    themes.append({
        "id": slug(it.get("name")),
        "title": title,
        "ref": rng,
        "blocks": blocks_of(it.find("body"), title),
    })

# ── Dictionary textboxes (articles) and charts ─────────────────────────
def build_simple(path):
    out = []
    for it in items(path):
        title = it.findtext("title")
        out.append({"id": slug(it.get("name")), "title": title, "blocks": blocks_of(it.find("body"), title)})
    out.sort(key=lambda x: x["title"].lower())
    return out

articles = build_simple(f"{DICT_DIR}/Textboxes/Textboxes.xml")
charts = build_simple(f"{DICT_DIR}/Charts/Charts.xml")

def dump(name, data):
    with open(f"{OUT_DIR}/{name}", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

dump("tyndale-book-intros.json", intros)
dump("tyndale-theme-notes.json", themes)
dump("tyndale-articles.json", articles)
dump("tyndale-charts.json", charts)

print(f"intros: {len(intros)} (with summary: {sum(1 for v in intros.values() if v['summary'])})")
print(f"themes: {len(themes)} (with passage ref: {sum(1 for t in themes if t['ref'])})")
print(f"articles: {len(articles)}  charts: {len(charts)}")
