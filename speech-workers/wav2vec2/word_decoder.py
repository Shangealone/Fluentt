"""Prompt-independent English dictionary decoding; uncertain spans stay explicit."""

import re
import unicodedata
from collections import Counter, defaultdict
from functools import lru_cache

ARPABET = dict(
    zip(
        [
            "AA",
            "AE",
            "AH",
            "AO",
            "AW",
            "AY",
            "B",
            "CH",
            "D",
            "DH",
            "EH",
            "ER",
            "EY",
            "F",
            "G",
            "HH",
            "IH",
            "IY",
            "JH",
            "K",
            "L",
            "M",
            "N",
            "NG",
            "OW",
            "OY",
            "P",
            "R",
            "S",
            "SH",
            "T",
            "TH",
            "UH",
            "UW",
            "V",
            "W",
            "Y",
            "Z",
            "ZH",
        ],
        [
            "ɑ",
            "æ",
            "ə",
            "ɔ",
            "aʊ",
            "aɪ",
            "b",
            "tʃ",
            "d",
            "ð",
            "ɛ",
            "ɜr",
            "eɪ",
            "f",
            "g",
            "h",
            "ɪ",
            "i",
            "dʒ",
            "k",
            "l",
            "m",
            "n",
            "ŋ",
            "oʊ",
            "ɔɪ",
            "p",
            "r",
            "s",
            "ʃ",
            "t",
            "θ",
            "ʊ",
            "u",
            "v",
            "w",
            "j",
            "z",
            "ʒ",
        ],
    )
)


def canonical(text):
    text = (
        unicodedata.normalize("NFC", text)
        .replace("ɡ", "g")
        .replace("ɹ", "r")
        .replace("ɾ", "t")
        .replace("ɚ", "ɜr")
        .replace("ʌ", "ə")
    )
    return "".join(c for c in text if c not in " ˈˌː|")


@lru_cache(maxsize=1)
def lexicon():
    import cmudict
    from wordfreq import top_n_list, zipf_frequency

    common = set(top_n_list("en", 50000))
    entries = []
    index = defaultdict(set)
    for word, phones in cmudict.entries():
        if word not in common or not re.fullmatch(r"[a-z]+(?:'[a-z]+)?", word):
            continue
        pronunciation = canonical(
            "".join(ARPABET[re.sub(r"\d", "", phone)] for phone in phones)
        )
        frequency = zipf_frequency(word, "en")
        item = (word, pronunciation, frequency)
        if not pronunciation:
            continue
        identifier = len(entries)
        entries.append(item)
        index[("first", pronunciation[0])].add(identifier)
        for size in (2, 3):
            for start in range(len(pronunciation) - size + 1):
                index[(size, pronunciation[start : start + size])].add(identifier)
    return entries, index


def decode_words(phonemes, language="english"):
    if language != "english":
        return {
            "status": "language_unavailable",
            "text": None,
            "reason": "A verified Filipino pronunciation lexicon is not installed.",
        }
    from rapidfuzz.distance import Levenshtein

    heard = canonical(phonemes)
    if not heard:
        return {"status": "no_speech", "text": None, "words": []}
    if len(heard) > 2000:
        return {"status": "too_long", "text": None}
    entries, index = lexicon()
    # Dynamic programming over phonetic positions. Unknown spans are legal;
    # the practice prompt is never an input to this decoder.
    paths = {0: (0.0, [])}
    for start in range(len(heard)):
        if start not in paths:
            continue
        cost, words = paths[start]

        def update(
            end,
            extra,
            word,
            uncertain=False,
            *,
            base_cost=cost,
            base_words=words,
            base_start=start,
        ):
            value = base_cost + extra
            if end not in paths or value < paths[end][0]:
                paths[end] = (value, base_words + [(word, uncertain, base_start, end)])

        update(start + 1, 1.1, "[unclear]", True)
        votes = Counter()
        window = heard[start : start + 18]
        for size in (2, 3):
            for offset in range(min(8, len(window) - size + 1)):
                for identifier in index.get((size, window[offset : offset + size]), ()):
                    votes[identifier] += size
        candidates = {item for item, _ in votes.most_common(120)}
        # Include short function words, which may not contain a bigram.
        candidates.update(
            i for i in index.get(("first", heard[start]), ()) if len(entries[i][1]) <= 3
        )
        for identifier in sorted(candidates):
            word, pronunciation, frequency = entries[identifier]
            length = len(pronunciation)
            limit = 0 if length <= 3 else min(2, int(length * 0.22))
            for size in range(max(1, length - limit), length + limit + 1):
                end = start + size
                if end > len(heard):
                    continue
                errors = Levenshtein.distance(
                    pronunciation, heard[start:end], score_cutoff=limit
                )
                if errors <= limit:
                    update(
                        end,
                        errors + 0.35 + max(0, 6 - frequency) * 0.12,
                        word,
                        errors > 0,
                    )
    _, words = paths[len(heard)]
    merged = []
    for word, uncertain, start, end in words:
        if word == "[unclear]" and merged and merged[-1]["word"] == word:
            merged[-1]["end"] = end
        else:
            merged.append(
                {"word": word, "uncertain": uncertain, "start": start, "end": end}
            )
    covered = sum(
        item["end"] - item["start"] for item in merged if item["word"] != "[unclear]"
    )
    return {
        "status": "candidate",
        "text": " ".join(item["word"] for item in merged),
        "words": [
            {k: v for k, v in item.items() if k in ("word", "uncertain")}
            for item in merged
        ],
        "contains_uncertain_words": any(item["uncertain"] for item in merged),
        "dictionary": "CMUdict 1.1.3 / wordfreq 3.1.1 top 50000 English words",
        "decoder_version": "phoneme-lexicon-v1",
        "covered_sound_fraction": round(covered / len(heard), 3),
    }
