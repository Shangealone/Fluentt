"""Deterministic pronunciation-category, evidence, and feedback policies.

All numeric handling is lossless decimal. Category comparison uses the raw
provider value; display rounding is presentation-only and never feeds back.
"""

import unicodedata
from decimal import ROUND_HALF_UP, Context, Decimal, InvalidOperation, localcontext
from typing import Any

from app.pronunciation.schemas import (
    CATEGORY_POLICY_VERSION,
    FEEDBACK_POLICY_VERSION,
    Issue,
    PhonemeObservation,
    WordObservation,
)

Category = str

WORD_ISSUE_TYPES = ("Mispronunciation", "Omission", "Insertion")
PHONEME_ISSUE_FLOOR = Decimal(60)
MAX_WORD_OBSERVATIONS = 64
MAX_PHONEMES_PER_WORD = 64
MAX_TOTAL_PHONEMES = 256
MAX_WORD_LABEL = 255
MAX_PHONEME_LABEL = 32


class ProviderResponseInvalid(Exception):
    """Malformed or out-of-bounds provider structure/scores."""


class PrimaryInvalid(Exception):
    """A present primary metric failed required numeric validation."""


def parse_primary(value: Any) -> Decimal:
    """Strict lossless parse of a provider primary; rejects bool/nonfinite/range."""
    if isinstance(value, bool) or not isinstance(value, (int, float, str, Decimal)):
        raise PrimaryInvalid("primary is not a number")
    try:
        with localcontext(Context(prec=32)):
            score = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise PrimaryInvalid("primary is not a finite decimal") from exc
    if not score.is_finite() or score < 0 or score > 100:
        raise PrimaryInvalid("primary outside [0,100]")
    return score


def parse_optional_score(value: Any) -> Decimal | None:
    if value is None:
        return None
    return parse_primary(value)


def category_for(score: Decimal) -> Category:
    if score >= Decimal(90):
        return "A"
    if score >= Decimal(75):
        return "B"
    if score >= Decimal(60):
        return "C"
    return "D"


def display_score(score: Decimal) -> str:
    """Two fractional digits, decimal half-up. Display only; never re-categorizes."""
    # Presentation must not inherit or mutate a caller's decimal context.
    with localcontext(Context(prec=32, rounding=ROUND_HALF_UP)):
        quantized = score.quantize(Decimal("0.01"))
    return f"{quantized:f}"


GENERAL_FEEDBACK_KEYS = {
    "A": "pronunciation.feedback.A",
    "B": "pronunciation.feedback.B",
    "C": "pronunciation.feedback.C",
    "D": "pronunciation.feedback.D",
}

UNSCORABLE_FEEDBACK_KEY = "pronunciation.feedback.unscorable"


def normalize_tokens(text: str) -> list[str]:
    """NFKC, casefold, typographic apostrophes to ASCII; letter/number runs with
    interior apostrophes only. Hyphens/other punctuation/whitespace are separators."""
    normalized = unicodedata.normalize("NFKC", text).casefold()
    normalized = normalized.replace("\u2019", "'").replace("\u2018", "'")
    tokens: list[str] = []
    current: list[str] = []
    for char in normalized:
        if char.isalnum() or char == "'" and current and current[-1].isalnum():
            current.append(char)
        else:
            if current:
                tokens.append("".join(current))
                current = []
    if current:
        tokens.append("".join(current))
    return tokens


def _bounded_decimal(value: Any, *, field: str) -> Decimal:
    if isinstance(value, bool):
        raise ProviderResponseInvalid(f"{field} is not a number")
    try:
        with localcontext(Context(prec=32)):
            score = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ProviderResponseInvalid(f"{field} is not a decimal") from exc
    if not score.is_finite() or score < 0 or score > 100:
        raise ProviderResponseInvalid(f"{field} outside [0,100]")
    return score


def parse_word_observations(raw_words: Any) -> list[WordObservation]:
    """Strict parse/bounds of ordered provider word evidence (§10 technical bounds)."""
    if not isinstance(raw_words, list):
        raise ProviderResponseInvalid("words is not an array")
    if len(raw_words) > MAX_WORD_OBSERVATIONS:
        raise ProviderResponseInvalid("too many word observations")
    words: list[WordObservation] = []
    total_phonemes = 0
    for index, raw in enumerate(raw_words):
        if not isinstance(raw, dict):
            raise ProviderResponseInvalid("word observation is not an object")
        label = raw.get("Word")
        if not isinstance(label, str) or not label or len(label) > MAX_WORD_LABEL:
            raise ProviderResponseInvalid("word label invalid")
        error_type = raw.get("ErrorType", "None")
        if error_type not in ("None", "Mispronunciation", "Omission", "Insertion"):
            raise ProviderResponseInvalid("unsupported word error type")
        accuracy_raw = raw.get("AccuracyScore")
        accuracy = (
            None
            if accuracy_raw is None
            else _bounded_decimal(accuracy_raw, field="word accuracy")
        )
        offset = raw.get("Offset")
        duration = raw.get("Duration")
        for value, field in ((offset, "offset"), (duration, "duration")):
            if value is not None and (
                isinstance(value, bool) or not isinstance(value, int) or value < 0
            ):
                raise ProviderResponseInvalid(f"word {field} invalid")
        phoneme_raw = raw.get("Phonemes", [])
        if (
            not isinstance(phoneme_raw, list)
            or len(phoneme_raw) > MAX_PHONEMES_PER_WORD
        ):
            raise ProviderResponseInvalid("phoneme list invalid")
        total_phonemes += len(phoneme_raw)
        if total_phonemes > MAX_TOTAL_PHONEMES:
            raise ProviderResponseInvalid("too many phonemes")
        phonemes: list[PhonemeObservation] = []
        for phoneme_index, raw_phoneme in enumerate(phoneme_raw):
            if not isinstance(raw_phoneme, dict):
                raise ProviderResponseInvalid("phoneme is not an object")
            phoneme_label = raw_phoneme.get("Phoneme")
            if (
                not isinstance(phoneme_label, str)
                or not phoneme_label
                or len(phoneme_label) > MAX_PHONEME_LABEL
            ):
                raise ProviderResponseInvalid("phoneme label invalid")
            phonemes.append(
                PhonemeObservation(
                    phoneme_index=phoneme_index,
                    target_unit=phoneme_label,
                    accuracy_score=_bounded_decimal(
                        raw_phoneme.get("AccuracyScore"), field="phoneme accuracy"
                    ),
                )
            )
        words.append(
            WordObservation(
                word_index=index,
                target_unit=label,
                is_target=False,  # Resolved against the reference target below.
                accuracy_score=accuracy,
                provider_error_type=error_type,
                offset_100ns=offset,
                duration_100ns=duration,
                phonemes=phonemes,
            )
        )
    return words


def resolve_target_evidence(
    term: str, words: list[WordObservation]
) -> tuple[list[WordObservation], bool]:
    """Mark target coverage per §9. Returns (observations, sufficient).

    Insertion observations are excluded from coverage matching. Remaining
    observations must cover the expected tokens in order with no Omission;
    a provider word spanning multiple tokens covers the contiguous sequence.
    Each matched target observation needs valid accuracy and positive duration.
    """
    expected = normalize_tokens(term)
    if not expected:
        raise ProviderResponseInvalid("term produced no tokens")
    for word in words:
        word.is_target = False
    candidates = [word for word in words if word.provider_error_type != "Insertion"]
    cursor = 0
    for word in candidates:
        if cursor >= len(expected):
            break
        word_tokens = normalize_tokens(word.target_unit)
        if not word_tokens:
            continue
        remaining = len(expected) - cursor
        if len(word_tokens) > remaining:
            continue
        if word_tokens == expected[cursor : cursor + len(word_tokens)]:
            if (
                word.provider_error_type == "Omission"
                or word.accuracy_score is None
                or word.duration_100ns is None
                or word.duration_100ns <= 0
            ):
                return words, False
            word.is_target = True
            cursor += len(word_tokens)
    return words, cursor == len(expected)


def select_issues(
    words: list[WordObservation], *, scored: bool
) -> tuple[list[Issue], list[str]]:
    """Deterministic word-then-phoneme issue selection (§10)."""
    issues: list[Issue] = []
    for word in words:
        if word.provider_error_type in WORD_ISSUE_TYPES:
            issues.append(
                Issue(
                    id=f"word:{word.word_index}",
                    level="word",
                    word_index=word.word_index,
                    phoneme_index=None,
                    target_unit=word.target_unit,
                    accuracy_score=word.accuracy_score,
                    provider_error_type=word.provider_error_type,
                )
            )
    if scored:
        candidates: list[tuple[Decimal, int, int, PhonemeObservation]] = []
        for word in words:
            if not word.is_target or word.provider_error_type == "Insertion":
                continue
            for phoneme in word.phonemes:
                if phoneme.accuracy_score < PHONEME_ISSUE_FLOOR:
                    candidates.append(
                        (
                            phoneme.accuracy_score,
                            word.word_index,
                            phoneme.phoneme_index,
                            phoneme,
                        )
                    )
        candidates.sort(key=lambda row: (row[0], row[1], row[2]))
        selected = sorted(candidates[:2], key=lambda row: (row[1], row[2]))
        for _, word_index, phoneme_index, phoneme in selected:
            issues.append(
                Issue(
                    id=f"phoneme:{word_index}:{phoneme_index}",
                    level="phoneme",
                    word_index=word_index,
                    phoneme_index=phoneme_index,
                    target_unit=phoneme.target_unit,
                    accuracy_score=phoneme.accuracy_score,
                    provider_error_type=None,
                )
            )
    refs = [issue.id for issue in issues]
    return issues, refs


def scored_feedback_key(category: Category) -> str:
    return GENERAL_FEEDBACK_KEYS[category]


def unscorable_word_issues(words: list[WordObservation]) -> list[Issue]:
    """Supported corrective word tags with null scores only; phonemes never render."""
    issues: list[Issue] = []
    for word in words:
        if word.provider_error_type in WORD_ISSUE_TYPES:
            issues.append(
                Issue(
                    id=f"word:{word.word_index}",
                    level="word",
                    word_index=word.word_index,
                    phoneme_index=None,
                    target_unit=word.target_unit,
                    accuracy_score=None,
                    provider_error_type=word.provider_error_type,
                )
            )
    return issues


CATEGORY_POLICY = CATEGORY_POLICY_VERSION
FEEDBACK_POLICY = FEEDBACK_POLICY_VERSION
