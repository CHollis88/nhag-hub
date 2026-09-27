# Clean the BSB token data (data/bible/bsb/*.json) in place.
#
# The BSB files were built from the Berean *interlinear* tables, which
# carry markers meant for an interlinear layout, not for reading:
#
#   ". . ."      placeholder for a source word whose English sits
#                elsewhere in the verse (~18,000 of them)
#   [the]        words the translators supplied  -> printed plain in BSB
#   {did}        words carried/moved             -> printed plain in BSB
#
# and they tag every English phrase as one unit ("the heavens", "He
# gave"), so ~99% of tokens carried a Strong's number and the reader
# underlined nearly every word. KJV, by contrast, tags ~41%: the key
# word, with "the"/"he"/"shall" left plain.
#
# This script, per token:
#   1. drops ". . ." placeholders (moving any trailing punctuation, e.g.
#      the "." in ". . ..", onto the previous word);
#   2. strips [ ] { } brackets;
#   3. untags G3588 (Greek article) and H853 (Hebrew direct-object
#      marker) -- pure grammar, nothing to look up;
#   4. splits leading function words off a tagged phrase into their own
#      untagged token: "the heavens" -> "the" + "heavens"(H8064), so
#      the underline lands on the meaning-carrying word.
#
# Idempotent: running it again on already-clean data changes nothing.
# Usage: python3 scripts/clean-bsb-tokens.py data/bible/bsb

import glob
import json
import re
import sys

DIR = sys.argv[1] if len(sys.argv) > 1 else "data/bible/bsb"

GRAMMAR_ONLY = {"G3588", "H853"}

FUNCTION_WORDS = {
    "the", "a", "an", "and", "of", "to", "in", "on", "at", "for", "from",
    "with", "by", "into", "upon", "unto", "as", "so", "then", "but", "or",
    "his", "her", "their", "its", "my", "your", "our", "he", "she", "it",
    "they", "we", "you", "i", "him", "them", "us", "me", "who", "which",
    "that", "this", "these", "those", "shall", "will", "would", "should",
    "may", "might", "can", "could", "must", "do", "did", "does", "has",
    "have", "had", "was", "were", "is", "are", "be", "been", "being",
    "not", "no", "let",
}

PLACEHOLDER = re.compile(r"^\s*(?:\.\s*){3}(.*)$")  # ". . ." + optional trailing text


def bare(word):
    return re.sub(r"[^\w']", "", word).lower()


# The interlinear placeholder is always SPACED dots (". . ."); the BSB's
# own ellipsis is unspaced ("..."), e.g. Ephesians 3:1 -- that one stays.
SPACED_DOTS = re.compile(r"\.\s\.\s\.")


def clean_verse(tokens):
    out = []
    carry = ""  # opening punctuation left alone by a removed placeholder
    for tok in tokens:
        text = tok["t"]
        if carry:
            text = carry + text.lstrip()
            carry = ""

        m = PLACEHOLDER.match(text)
        if m:
            tail = m.group(1).strip()
            if not tail:
                continue  # bare placeholder
            if re.fullmatch(r"[^\w\s]+", tail):
                if out:  # ". . .," -> keep the comma on the previous word
                    out[-1]["t"] = out[-1]["t"].rstrip() + tail
                continue
            text = tail  # placeholder glued to a real word (rare)

        text = SPACED_DOTS.sub("", text)  # placeholders glued onto a word
        text = re.sub(r"[\[\]{}]", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        text = re.sub(r"\s+([,.;:!?\u2019\u201d])", r"\1", text)  # "forgiven ." -> "forgiven."
        if not text:
            continue
        if re.fullmatch(r"[^\w]+", text):
            # Punctuation-only token, e.g. ", \u201c": the closing part
            # belongs to the previous word, any opening quote/paren to the next.
            m2 = re.fullmatch(r"([^\u201c\u2018(]*?)\s*([\u201c\u2018(]*)", text)
            closing, opening = (m2.group(1).strip(), m2.group(2)) if m2 else (text, "")
            if closing and out:
                out[-1]["t"] = out[-1]["t"].rstrip() + closing
            elif closing:
                opening = closing + opening
            carry = opening
            continue

        strongs = [s for s in tok.get("s", []) if s not in GRAMMAR_ONLY]
        base = {k: v for k, v in tok.items() if k not in ("t", "s")}

        words = text.split(" ")
        if strongs and len(words) > 1:
            k = 0
            while k < len(words) - 1 and bare(words[k]) in FUNCTION_WORDS:
                k += 1
            if k > 0:
                out.append({**base, "t": " ".join(words[:k]), "s": []})
                out.append({**base, "t": " ".join(words[k:]), "s": strongs})
                continue

        out.append({**base, "t": text, "s": strongs})
    return out


stats = {"before": 0, "after": 0, "tagged_before": 0, "tagged_after": 0}
for path in sorted(glob.glob(f"{DIR}/*.json")):
    with open(path, encoding="utf-8") as f:
        book = json.load(f)
    for ch, verses in book["chapters"].items():
        for v, toks in verses.items():
            stats["before"] += len(toks)
            stats["tagged_before"] += sum(1 for t in toks if t.get("s"))
            new = clean_verse(toks)
            verses[v] = new
            stats["after"] += len(new)
            stats["tagged_after"] += sum(1 for t in new if t.get("s"))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(book, f, ensure_ascii=False, separators=(",", ":"))

print(stats)
print(f"tagged: {100*stats['tagged_before']/stats['before']:.1f}% -> {100*stats['tagged_after']/stats['after']:.1f}%")
