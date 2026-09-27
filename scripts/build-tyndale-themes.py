# Tyndale Open Study Notes ThemeNotes.xml -> data/bible/tyndale-themes.json
# Same [{word, lines}] shape as the dictionary build, but kept as its
# OWN source rather than merged into it: these are thematic essays
# ("God's Covenant with Noah", "The Grace of God"), not word/name
# definitions, and some titles legitimately overlap in subject with a
# dictionary article under a different name (e.g. dictionary "Grace"
# vs theme "The Grace of God") -- worth surfacing as a distinct,
# separately-labeled source rather than silently merged in with one
# entry shadowing the other.
#
# CC BY-SA 4.0, Tyndale House Publishers.

import xml.etree.ElementTree as ET
import json
import re

SRC_PATH = "/home/claude/tyndale_notes/Tyndale Open Study Notes/ThemeNotes.xml"
OUT_PATH = "/home/claude/data/bible/tyndale-themes.json"

def element_text(el):
    parts = [el.text or ""]
    for child in el:
        parts.append(element_text(child))
        parts.append(child.tail or "")
    return "".join(parts)

def clean(s):
    return re.sub(r"\s+", " ", s).strip()

entries = []
tree = ET.parse(SRC_PATH)
for item in tree.getroot().findall("item"):
    if item.get("typename") != "ThemeNote":
        continue
    title_el = item.find("title")
    word = clean(title_el.text) if title_el is not None and title_el.text else item.get("name")
    body = item.find("body")
    if body is None:
        continue
    lines = []
    for p in body.findall("p"):
        if (p.get("class") or "") == "theme-title":
            continue
        text = clean(element_text(p))
        if text:
            lines.append(text)
    if lines:
        entries.append({"word": word, "lines": lines})

print(f"Extracted {len(entries)} theme entries")
with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(entries, f, ensure_ascii=False)
