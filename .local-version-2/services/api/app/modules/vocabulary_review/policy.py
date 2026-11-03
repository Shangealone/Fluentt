"""Review-only checking. Never changes the general assignment grading policy."""
from dataclasses import dataclass
import unicodedata

CHECKING_VERSION = "vocabulary-nfc-trim-casefold-v1"
RATING_VERSION = "objective-failure-again-v1"


def normalize_answer(value: str) -> str:
    return unicodedata.normalize("NFC", value.strip()).casefold()


@dataclass(frozen=True)
class AnswerCheck:
    raw_response: str
    correct: bool
    matched_form: str | None
    display_answer: str
    checking_version: str = CHECKING_VERSION


def check_answer(card, question_format: str, raw_response: str) -> AnswerCheck:
    if not isinstance(raw_response, str) or not raw_response.strip() or len(raw_response) > 2000:
        raise ValueError("Enter or select an answer before checking it.")
    if question_format == "multiple_choice":
        choices = {row.id: row.text for row in card.options}
        if raw_response not in choices:
            raise ValueError("Choose an available option.")
        correct = raw_response == card.correct_option_id
        return AnswerCheck(raw_response, correct, raw_response if correct else None, choices[card.correct_option_id])
    if question_format != "typed_recall":
        raise ValueError("Unsupported vocabulary question format.")
    matched = next((form for form in card.accepted_forms if normalize_answer(form) == normalize_answer(raw_response)), None)
    return AnswerCheck(raw_response, matched is not None, matched, card.accepted_forms[0])


def effective_rating(correct: bool, raw_rating: str) -> str:
    if raw_rating not in ("again", "hard", "good", "easy"):
        raise ValueError("Choose an available recall rating.")
    return raw_rating if correct else "again"


def assigned_condition(mapping: int, pool: str) -> str:
    if type(mapping) is not int or mapping not in (1, 2) or pool not in ("A", "B"):
        raise ValueError("A confirmed mapping and pool are required.")
    return "fsrs6" if (mapping == 1) == (pool == "A") else "esr"


def format_for(position: int, revision: int) -> str:
    if type(position) is not int or position < 0 or type(revision) is not int or revision < 1:
        raise ValueError("A pinned item position and positive review revision are required.")
    return "multiple_choice" if (position + revision) % 2 else "typed_recall"


def public_card(card, question_format: str) -> dict:
    """No term/meaning/accepted forms/correct ID in the pre-answer projection."""
    if question_format not in ("multiple_choice", "typed_recall"):
        raise ValueError("Unsupported vocabulary question format.")
    return dict(vocabulary_item_id=str(card.vocabulary_item_id), content_version=card.content_version,
                format=question_format, prompt=card.choice_prompt if question_format == "multiple_choice" else card.typed_prompt,
                options=[row.model_dump() for row in card.options] if question_format == "multiple_choice" else [])
