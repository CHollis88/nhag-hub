# One-time build script: Tyndale Open Bible Dictionary Articles/*.xml
# -> data/bible/tyndale-dictionary.json, same [{word, lines}] shape as
# smiths.json/hitchcocks.json/torreys.json, so it drops straight into
# the existing multi-dictionary lookup in lib/bible.js with no changes
# to that lookup code -- just one more entry in loadAllDictionaries().
#
# `lines` (one string per paragraph) rather than `text` (one big
# string): Tyndale's articles are genuinely long-form, multi-paragraph,
# sometimes with subheadings -- Easton's/Webster's single-paragraph
# `text` shape would collapse all of that into one dense block. Smith's/
# Hitchcock's/Torrey's already render as `lines`, one <p> per array
# entry, which is the right shape for this.
#
# CC BY-SA 4.0, Tyndale House Publishers -- copy/redistribute permitted
# with attribution. See TyndaleOpenBibleDictionary.zip/_README.txt.

import xml.etree.ElementTree as ET
import json
import re
import glob

SRC_DIR = "/home/claude/tyndale_dict/Articles"
OUT_PATH = "/home/claude/data/bible/tyndale-dictionary.json"

def element_text(el):
    """Flatten an element's text content, keeping inline scripture-ref
    link labels (<a href="?bref=...">Ex 7:7</a> -> "Ex 7:7") and
    dropping everything else down to plain text."""
    parts = [el.text or ""]
    for child in el:
        parts.append(element_text(child))
        parts.append(child.tail or "")
    return "".join(parts)

def clean(s):
    return re.sub(r"\s+", " ", s).strip()

entries = []
seen_names = set()

for path in sorted(glob.glob(f"{SRC_DIR}/*.xml")):
    tree = ET.parse(path)
    for item in tree.getroot().findall("item"):
        if item.get("typename") != "Article":
            continue  # skips the one "DictionaryLetter" TOC item per file
        name = item.get("name")
        if not name or name in seen_names:
            continue  # a few names are duplicated across letter files; first wins
        seen_names.add(name)

        title_el = item.find("title")
        word = clean(title_el.text) if title_el is not None and title_el.text else name

        body = item.find("body")
        if body is None:
            continue

        lines = []
        for p in body.findall("p"):
            cls = p.get("class") or ""
            if cls == "h1":
                continue  # redundant all-caps repeat of the title
            text = clean(element_text(p))
            if text:
                lines.append(text)

        if lines:
            entries.append({"word": word, "lines": lines})

dict_count = len(entries)

# Profiles (124 people, e.g. "Adam and Eve", "Moses") are structurally
# identical to Articles -- <item><title/><body><p>...</p></body></item>
# -- so they merge into the SAME lookup. Only added where the name isn't
# already covered by an Article: where a person has both, the Article is
# the fuller general-purpose entry and the Profile's real value (its
# `refs` field, a suggested reading range) isn't used by this lookup
# shape anyway, so there's nothing lost by preferring the Article.
PROFILES_PATH = "/home/claude/tyndale_notes/Tyndale Open Study Notes/Profiles.xml"
profiles_added = 0
tree = ET.parse(PROFILES_PATH)
for item in tree.getroot().findall("item"):
    if item.get("typename") != "Profile":
        continue
    title_el = item.find("title")
    word = clean(title_el.text) if title_el is not None and title_el.text else item.get("name")
    if word in seen_names:
        continue
    seen_names.add(word)
    body = item.find("body")
    if body is None:
        continue
    lines = []
    for p in body.findall("p"):
        if (p.get("class") or "") == "profile-title":
            continue
        text = clean(element_text(p))
        if text:
            lines.append(text)
    if lines:
        entries.append({"word": word, "lines": lines})
        profiles_added += 1

print(f"Extracted {dict_count} dictionary entries + {profiles_added} profile entries (gap-fill) = {len(entries)} total")
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(entries, f, ensure_ascii=False)

# Sanity spot-check
sample = next(e for e in entries if e["word"] == "Aaron")
print("--- Aaron sample ---")
print(f"word: {sample['word']}")
print(f"paragraphs: {len(sample['lines'])}")
print(sample["lines"][0][:200])
