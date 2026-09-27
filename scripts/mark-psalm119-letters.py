# Psalm 119's 22 Hebrew-letter section headings (an acrostic: each
# 8-verse stanza begins with the next letter of the Hebrew alphabet).
#
#   KJV: the letters are already in the text as the first word of verses
#        1, 9, 17 ... 169 ("ALEPH.", "BETH.") -- flagged "ti" so the reader
#        draws them on their own line above the stanza, like Psalm
#        titles. Flag only: no tokens move, so highlights are unaffected.
#   BSB: the source this app's BSB was built from omits them entirely
#        (the published BSB has them) -- added as "_sup:<verse>" entries
#        in the chapter's headings, which the reader draws the same way.
#
# Idempotent. Usage: python3 scripts/mark-psalm119-letters.py data/bible
import json
import re
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "data/bible"
STANZA_STARTS = [str(v) for v in range(1, 177, 8)]  # 1, 9, ... 169
BSB_LETTERS = [
    "Aleph", "Beth", "Gimel", "Daleth", "He", "Vav", "Zayin", "Heth",
    "Teth", "Yodh", "Kaph", "Lamedh", "Mem", "Nun", "Samekh", "Ayin",
    "Pe", "Tsadhe", "Qoph", "Resh", "Shin", "Tav",
]

# KJV
path = f"{ROOT}/kjv/Psa.json"
kjv = json.load(open(path, encoding="utf-8"))
chs = kjv["chapters"] if "chapters" in kjv else kjv
marked = 0
for v in STANZA_STARTS:
    tok = chs["119"][v][0]
    assert re.fullmatch(r"[A-Z]+\.", tok["t"]), f"unexpected KJV 119:{v} start {tok['t']!r}"
    tok["ti"] = True
    marked += 1
json.dump(kjv, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

# BSB
path = f"{ROOT}/bsb/Psa.json"
bsb = json.load(open(path, encoding="utf-8"))
h = bsb.setdefault("headings", {}).setdefault("119", {})
for v, name in zip(STANZA_STARTS, BSB_LETTERS):
    h[f"_sup:{v}"] = name
json.dump(bsb, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

print(f"KJV letters flagged: {marked}; BSB letters added: {len(BSB_LETTERS)}")
