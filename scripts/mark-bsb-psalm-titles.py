# Mark Psalm superscriptions in the BSB as titles (token flag "ti": 1).
#
# The BSB source has no markup around Psalm titles ("A Psalm of David."),
# so they read as part of verse 1. KJV's data DOES mark them, and both
# carry Strong's numbers -- so the title is found by meaning, not wording:
#
#   S = the Strong's numbers in KJV's title for this psalm
#   Walk BSB verse 1 sentence by sentence; a sentence is title text if
#   most of its tagged words are in S. Stop at the first one that isn't.
#
# e.g. Psalm 51: "For the choirmaster. A Psalm of David. When Nathan the
# prophet came to him after his adultery with Bathsheba." all match KJV's
# title numbers; "Have mercy on me, O God..." doesn't.
#
# Only sets a flag, never adds/removes tokens, so highlight positions
# are unaffected. Idempotent. Run after clean-bsb-tokens.py.
# Usage: python3 scripts/mark-bsb-psalm-titles.py data/bible

import json
import re
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "data/bible"
kjv = json.load(open(f"{ROOT}/kjv/Psa.json", encoding="utf-8"))
kjv = kjv["chapters"] if "chapters" in kjv else kjv
path = f"{ROOT}/bsb/Psa.json"
bsb = json.load(open(path, encoding="utf-8"))

END = re.compile(r"[.!?][\u201d\u2019\"']*$")

# Standard title vocabulary, for sentences whose Strong's numbers differ
# from KJV's -- KJV transliterates tune names and musical terms
# ("Shushaneduth", "degrees") where the BSB translates them ("To the tune
# of 'The Lily of the Covenant'", "ascents").
TITLE_PHRASE = re.compile(
    r"^(?:(?:a|an)\s+)?(?:psalm|song|prayer|maskil|miktam|shiggaion)\b"
    r"|^(?:for|to)\s+the\s+(?:choirmaster|chief|director|tune)\b"
    r"|^according\s+to\b|^with\s+(?:stringed|the\s+flutes)\b"
    r"|^of\s+(?:david|asaph|solomon|moses|heman|ethan|the\s+sons)\b"
    r"|^for\s+the\s+sons\s+of\b|^a\s+song\s+of\s+ascents\b",
    re.I,
)
marked, skipped = 0, []

for ps, verses in bsb["chapters"].items():
    toks = verses.get("1") or []
    for t in toks:
        t.pop("ti", None)  # recompute from scratch (idempotent)
    ktoks = (kjv.get(ps) or {}).get("1") or []
    S = {s for t in ktoks if t.get("ti") for s in t.get("s", [])}
    if not S:
        continue

    # split into sentences (index ranges)
    sentences, start = [], 0
    for i, t in enumerate(toks):
        if END.search(t["t"]):
            sentences.append((start, i + 1))
            start = i + 1
    if start < len(toks):
        sentences.append((start, len(toks)))

    title_end = 0
    for a, b in sentences:
        tagged = [t for t in toks[a:b] if t.get("s")]
        if not tagged and not TITLE_PHRASE.search(" ".join(t["t"] for t in toks[a:b])):
            break
        hits = sum(1 for t in tagged if set(t["s"]) & S)
        text = " ".join(t["t"] for t in toks[a:b]).strip("\u201c\u201d\"' ")
        if hits / len(tagged) > 0.5 or TITLE_PHRASE.search(text):
            title_end = b
        else:
            break

    if title_end == 0:
        skipped.append(ps)
        continue
    if title_end >= len(toks):
        skipped.append(ps)  # would swallow the whole verse -- don't guess
        continue
    for t in toks[:title_end]:
        t["ti"] = 1
    marked += 1

json.dump(bsb, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"psalm titles marked: {marked}; KJV has a title but BSB not matched: {skipped}")
