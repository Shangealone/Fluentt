"""Corpus ASR error metrics, never learner pronunciation grades."""
from .speech_text import normalize


def edit_distance(reference, hypothesis):
    previous = list(range(len(hypothesis) + 1))
    for i, left in enumerate(reference, 1):
        current = [i]
        for j, right in enumerate(hypothesis, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j-1] + (left != right)))
        previous = current
    return previous[-1]


def asr_metrics(pairs):
    word_errors = char_errors = words = chars = 0
    for expected, recognized in pairs:
        a, b = normalize(expected), normalize(recognized)
        if not a:
            raise ValueError("Empty normalized evaluation reference")
        word_errors += edit_distance(a.split(), b.split())
        # CER includes normalized inter-word spaces; report this convention with the result.
        char_errors += edit_distance(a, b)
        words += len(a.split())
        chars += len(a)
    if not words or not chars:
        raise ValueError("No evaluation pairs")
    return {"word_errors": word_errors, "reference_words": words, "wer": word_errors / words,
            "character_errors": char_errors, "reference_characters": chars, "cer": char_errors / chars,
            "cer_includes_spaces": True, "metric_type": "asr_text_error_not_pronunciation"}
