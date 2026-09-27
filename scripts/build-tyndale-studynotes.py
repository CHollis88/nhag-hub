# Tyndale Open Study Notes StudyNotes.xml -> data/bible/tyndale-studynotes.json
#
# Same shape as matthew-henry-concise.json: { "Abbr|Chapter": [{v1, v2,
# text}, ...] }. This is the flagship piece -- a second, translation-
# agnostic commentary source (verse-keyed, not KJV-word-keyed like
# Matthew Henry), meant to sit alongside it and be selectable as the
# default in-reading commentary.
#
# CC BY-SA 4.0, Tyndale House Publishers.
#
# The real complexity here: Tyndale's own reference names use a
# DIFFERENT book-abbreviation convention than this app (ISam, IIChr,
# Phlm, Song, Pr...), and -- unlike Matthew Henry, which is strictly
# one-chapter-at-a-time -- a real number of these notes span MULTIPLE
# chapters as a literary unit (e.g. "Gen.11.27-25.11", the whole
# Abraham narrative, 14 chapters). Since the app fetches and displays
# one chapter at a time, a spanning note needs to appear on EVERY
# chapter it touches, with locally-valid v1/v2 bounds for that specific
# chapter -- not the original cross-chapter numbers, which would be
# meaningless compared against a single chapter's verse numbers.

import xml.etree.ElementTree as ET
import json
import re
from collections import defaultdict

SRC_PATH = "/home/claude/tyndale_notes/Tyndale Open Study Notes/StudyNotes.xml"
OUT_PATH = "/home/claude/data/bible/tyndale-studynotes.json"

TYNDALE_TO_APP = {
    "Gen": "Gen", "Exod": "Exo", "Lev": "Lev", "Num": "Num", "Deut": "Deu",
    "Josh": "Jos", "Judg": "Jdg", "Ruth": "Rth", "ISam": "1Sa", "IISam": "2Sa",
    "IKgs": "1Ki", "IIKgs": "2Ki", "IChr": "1Ch", "IIChr": "2Ch", "Ezra": "Ezr",
    "Neh": "Neh", "Esth": "Est", "Job": "Job", "Ps": "Psa", "Pr": "Pro",
    "Eccl": "Ecc", "Song": "Sng", "Isa": "Isa", "Jer": "Jer", "Lam": "Lam",
    "Ezek": "Eze", "Dan": "Dan", "Hos": "Hos", "Joel": "Joe", "Amos": "Amo",
    "Obad": "Oba", "Jon": "Jon", "Mic": "Mic", "Nah": "Nah", "Hab": "Hab",
    "Zeph": "Zep", "Hagg": "Hag", "Zech": "Zec", "Mal": "Mal",
    "Matt": "Mat", "Mark": "Mar", "Luke": "Luk", "John": "Jhn", "Acts": "Act",
    "Rom": "Rom", "ICor": "1Co", "IICor": "2Co", "Gal": "Gal", "Eph": "Eph",
    "Phil": "Phl", "Col": "Col", "IThes": "1Th", "IIThes": "2Th", "ITim": "1Ti",
    "IITim": "2Ti", "Titus": "Tit", "Phlm": "Phm", "Heb": "Heb", "Jas": "Jas",
    "IPet": "1Pe", "IIPet": "2Pe", "IJn": "1Jo", "IIJn": "2Jo", "IIIJn": "3Jo",
    "Jude": "Jde", "Rev": "Rev",
}

REF_RE = re.compile(
    r"^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:-(?:(\d+)\.)?(\d+))?$"
)

def parse_ref(name):
    """
    'Gen.1.1'        -> Gen, [(1, 1, 1)]
    'Gen.1.3-13'      -> Gen, [(1, 3, 13)]
    'Gen.1.1-2.3'     -> Gen, [(1, 1, 999), (2, 1, 3)]
    'Gen.11.27-25.11' -> Gen, [(11, 27, 999), (12,1,999), ..., (25, 1, 11)]
    999 is an open-ended "through end of chapter" sentinel -- no real
    chapter has that many verses, so it's safe as an upper bound for
    the membership check in getCommentaryForVerse-style filtering.
    """
    m = REF_RE.match(name)
    if not m:
        return None, []
    book, c1, v1, c2, v2 = m.groups()
    c1 = int(c1); v1 = int(v1)
    if c2 is None and v2 is None:
        return book, [(c1, v1, v1)]
    if c2 is None:
        return book, [(c1, v1, int(v2))]
    c2 = int(c2); v2 = int(v2)
    if c1 == c2:
        return book, [(c1, v1, v2)]
    spans = [(c1, v1, 999)]
    for c in range(c1 + 1, c2):
        spans.append((c, 1, 999))
    spans.append((c2, 1, v2))
    return book, spans

def element_text(el):
    parts = [el.text or ""]
    for child in el:
        parts.append(element_text(child))
        parts.append(child.tail or "")
    return "".join(parts)

def clean(s):
    return re.sub(r"\s+", " ", s).strip()

chapters = defaultdict(list)  # "Abbr|Chapter" -> [{v1,v2,text}]
skipped_books = set()
total = 0

tree = ET.parse(SRC_PATH)
for item in tree.getroot().findall("item"):
    if item.get("typename") != "StudyNote":
        continue
    name = item.get("name", "")
    tyndale_book, spans = parse_ref(name)
    if not tyndale_book or not spans:
        continue
    abbr = TYNDALE_TO_APP.get(tyndale_book)
    if not abbr:
        skipped_books.add(tyndale_book)
        continue

    body = item.find("body")
    if body is None:
        continue
    p = body.find("p")
    if p is None:
        continue

    # Drop the leading sn-ref span (just restates "11:27-25:11" etc,
    # which the app already shows as the note's own verse-range header)
    # before flattening the rest to plain text.
    p_copy_parts = []
    for child in list(p):
        if child.tag == "span" and child.get("class") == "sn-ref":
            # Skip the span's OWN content (it just restates "11:27-25:11",
            # redundant with the note's own verse-range header) but its
            # TAIL is the note's real opening text ("These verses
            # introduce...") and must still be kept -- `continue` here
            # would silently drop the start of every single note.
            p_copy_parts.append(child.tail or "")
            continue
        p_copy_parts.append(element_text(child) + (child.tail or ""))
    text = clean((p.text or "") + "".join(p_copy_parts))
    if not text:
        continue

    for (ch, v1, v2) in spans:
        chapters[f"{abbr}|{ch}"].append({"v1": v1, "v2": v2, "text": text})
        total += 1

print(f"Wrote {total} note-instances across {len(chapters)} chapter keys")
if skipped_books:
    print("SKIPPED (no book mapping):", sorted(skipped_books))

with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(dict(chapters), f, ensure_ascii=False)

# Spot check
sample = chapters.get("Gen|1", [])
print(f"\nGen 1 has {len(sample)} notes. First one:")
print(sample[0])
big = chapters.get("Gen|15", [])
print(f"\nGen 15 (inside the 14-chapter Abraham span) has {len(big)} notes, spot-checking span text present:")
print(any("Terah" in n["text"] for n in big))
