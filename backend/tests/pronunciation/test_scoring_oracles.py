"""Deterministic scoring oracles from P02 §7-§10 (pure, no DB, no provider)."""

from decimal import Decimal

import pytest

from app.pronunciation import scoring
from app.pronunciation.schemas import PhonemeObservation, WordObservation


@pytest.mark.parametrize(
    ("value", "category"),
    [
        ("100", "A"),
        ("90", "A"),
        ("89.995", "B"),
        ("90.00499999", "A"),
        ("75", "B"),
        ("74.9999", "C"),
        ("60", "C"),
        ("59.999", "D"),
        ("0", "D"),
    ],
)
def test_category_boundaries_use_unrounded_decimal(value: str, category: str) -> None:
    assert scoring.category_for(Decimal(value)) == category


def test_display_rounds_half_up_but_never_recategorizes() -> None:
    score = Decimal("89.995")
    assert scoring.category_for(score) == "B"
    assert scoring.display_score(score) == "90.00"
    assert scoring.display_score(Decimal("59.999")) == "60.00"
    assert scoring.category_for(Decimal("59.999")) == "D"
    assert scoring.display_score(Decimal(0)) == "0.00"


@pytest.mark.parametrize(
    "bad",
    [True, False, "abc", "nan", "inf", "-inf", 101, -1, None],
)
def test_parse_primary_rejects_bad_values(bad) -> None:
    with pytest.raises(scoring.PrimaryInvalid):
        scoring.parse_primary(bad)


def test_parse_primary_accepts_lossless_forms() -> None:
    assert scoring.parse_primary("89.995") == Decimal("89.995")
    assert scoring.parse_primary(75) == Decimal(75)
    assert scoring.parse_primary(Decimal("60.00")) == Decimal("60.00")


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Good Morning", ["good", "morning"]),
        ("don't stop", ["don't", "stop"]),
        ("don\u2019t", ["don't"]),
        ("high-level", ["high", "level"]),
        ("na\u00efve café", ["naïve", "café"]),
        ("word123 x", ["word123", "x"]),
        ("...  ", []),
        ("A  B   C", ["a", "b", "c"]),
    ],
)
def test_normalize_tokens(text: str, expected: list[str]) -> None:
    assert scoring.normalize_tokens(text) == expected


def _word(
    index: int,
    label: str,
    *,
    error: str = "None",
    accuracy: float | None = 90.0,
    duration: int | None = 900_000,
    phonemes: list | None = None,
) -> WordObservation:
    return WordObservation(
        word_index=index,
        target_unit=label,
        is_target=False,
        accuracy_score=None if accuracy is None else Decimal(str(accuracy)),
        provider_error_type=error,  # type: ignore[arg-type]
        offset_100ns=index * 1_000_000,
        duration_100ns=duration,
        phonemes=[
            PhonemeObservation(
                phoneme_index=phoneme_index,
                target_unit=label[0:2] or "ah",
                accuracy_score=Decimal(str(value)),
            )
            for phoneme_index, value in enumerate(phonemes or [])
        ],
    )


def test_target_evidence_covers_in_order_and_marks_targets() -> None:
    words = [_word(0, "good"), _word(1, "morning")]
    observations, sufficient = scoring.resolve_target_evidence("good morning", words)
    assert sufficient
    assert [word.is_target for word in observations] == [True, True]


def test_target_evidence_fails_when_middle_token_omitted_from_words() -> None:
    words = [_word(0, "can"), _word(1, "you"), _word(2, "this")]
    _, sufficient = scoring.resolve_target_evidence("can you help me this", words)
    assert not sufficient


def test_target_evidence_fails_on_null_accuracy_of_matched_word() -> None:
    words = [_word(0, "good"), _word(1, "morning", accuracy=None)]
    _, sufficient = scoring.resolve_target_evidence("good morning", words)
    assert not sufficient


def test_target_evidence_fails_on_zero_duration() -> None:
    words = [_word(0, "good", duration=0), _word(1, "morning")]
    _, sufficient = scoring.resolve_target_evidence("good morning", words)
    assert not sufficient


def test_insertions_never_satisfy_coverage_but_stay_observable() -> None:
    words = [
        _word(0, "good"),
        _word(1, "um", error="Insertion"),
        _word(2, "morning"),
    ]
    observations, sufficient = scoring.resolve_target_evidence("good morning", words)
    assert sufficient
    assert observations[1].is_target is False


def test_select_issues_word_first_then_two_lowest_phonemes() -> None:
    words = [
        _word(0, "good", phonemes=[92, 58, 34, 71]),
        _word(1, "morning", error="Mispronunciation", accuracy=45.0, phonemes=[95, 88]),
        _word(2, "water", phonemes=[90, 55, 61]),
    ]
    scoring.resolve_target_evidence("good morning water", words)
    issues, refs = scoring.select_issues(words, scored=True)
    word_issues = [issue for issue in issues if issue.level == "word"]
    phoneme_issues = [issue for issue in issues if issue.level == "phoneme"]
    assert [issue.id for issue in word_issues] == ["word:1"]
    # Strictly below 60: 34 (w0:p2), 58 (w0:p1), 55 (w2:p1) -> two lowest are 34 and 55.
    assert [issue.id for issue in phoneme_issues] == ["phoneme:0:2", "phoneme:2:1"]
    assert [issue.accuracy_score for issue in phoneme_issues] == [
        Decimal(34),
        Decimal(55),
    ]
    assert refs == [issue.id for issue in issues]
    assert issues[0].level == "word"
    assert len({issue.id for issue in issues}) == len(issues)


def test_select_issues_phoneme_floor_is_exclusive() -> None:
    words = [_word(0, "good", phonemes=[60, 59.99])]
    scoring.resolve_target_evidence("good", words)
    issues, _ = scoring.select_issues(words, scored=True)
    assert [issue.id for issue in issues] == ["phoneme:0:1"]


def test_select_issues_without_scored_flag_never_adds_phonemes() -> None:
    words = [_word(0, "good", error="Mispronunciation", phonemes=[10])]
    issues, _ = scoring.select_issues(words, scored=False)
    assert [issue.level for issue in issues] == ["word"]


def test_unscorable_word_issues_have_null_scores_and_no_phonemes() -> None:
    words = [
        _word(0, "good"),
        _word(1, "morning", error="Omission"),
        _word(2, "water", error="Insertion"),
    ]
    issues = scoring.unscorable_word_issues(words)
    assert [issue.id for issue in issues] == ["word:1", "word:2"]
    assert all(issue.accuracy_score is None for issue in issues)
    assert all(issue.phoneme_index is None for issue in issues)


def test_feedback_keys_are_frozen_policy_values() -> None:
    assert scoring.scored_feedback_key("A") == "pronunciation.feedback.A"
    assert scoring.scored_feedback_key("D") == "pronunciation.feedback.D"
    assert scoring.UNSCORABLE_FEEDBACK_KEY == "pronunciation.feedback.unscorable"
