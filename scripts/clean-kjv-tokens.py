# Clean leftover source markup from the KJV token data in place.
#
# Found in data/bible/kjv (all from the original source file):
#   [[A Psalm of David.]]   Psalm superscriptions wrapped in double
#                           brackets inside verse 1 (116 psalms)
#   Amen.[fn]               footnote markers
#   heard[G4364]            a raw Strong's code in the text
#   em>that                 a fragment of an HTML tag
#   sin&#8212;;             an undecoded HTML entity (Exodus 32:32)
#
# Superscription words are kept (they are part of the KJV text) but
# lose the brackets and get "ti": true so the reader can style them as
# a title. NOTHING is added or removed as a token: highlights are
# stored as token positions, so KJV word positions must never shift.
#
# Idempotent. Usage: python3 scripts/clean-kjv-tokens.py data/bible/kjv

import glob
import html
import json
import re
import sys

DIR = sys.argv[1] if len(sys.argv) > 1 else "data/bible/kjv"
STRONGS_IN_TEXT = re.compile(r"\[([GH]\d+)\]")

counts = {"superscription_tokens": 0, "fn": 0, "strongs_in_text": 0, "html": 0}
for path in sorted(glob.glob(f"{DIR}/*.json")):
    with open(path, encoding="utf-8") as f:
        book = json.load(f)
    chapters = book["chapters"] if "chapters" in book else book
    for verses in chapters.values():
        for toks in verses.values():
            before = len(toks)
            in_title = False
            for tok in toks:
                t = tok["t"]
                if "[[" in t:
                    in_title = True
                if in_title:
                    tok["ti"] = True
                    counts["superscription_tokens"] += 1
                if "]]" in t:
                    in_title = False
                t = t.replace("[[", "").replace("]]", "")
                if "[fn]" in t:
                    t = t.replace("[fn]", "")
                    counts["fn"] += 1
                for code in STRONGS_IN_TEXT.findall(t):
                    if code not in tok.get("s", []):
                        tok.setdefault("s", []).append(code)
                    counts["strongs_in_text"] += 1
                t = STRONGS_IN_TEXT.sub("", t)
                if re.search(r"</?\w*>|^\w{1,6}>", t):
                    t = re.sub(r"</?\w*>|^\w{1,6}>", "", t)
                    counts["html"] += 1
                t = html.unescape(t)  # e.g. "sin&#8212;;" -> "sin—;" (Exodus 32:32)
                # A token that was ONLY markup (a lone "[[") becomes empty
                # rather than being removed, so positions still don't shift;
                # the reader skips empty tokens.
                tok["t"] = t.strip()
            assert len(toks) == before  # positions must never shift
    with open(path, "w", encoding="utf-8") as f:
        json.dump(book, f, ensure_ascii=False, separators=(",", ":"))
print(counts)
