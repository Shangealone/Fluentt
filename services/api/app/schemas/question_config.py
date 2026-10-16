"""Version-one storage contracts. These validate structure, not grade answers."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StringConstraints

TextValue = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Identifier = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{1,80}$")]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class EmptyContent(StrictModel):
    pass


class Item(StrictModel):
    id: Identifier
    text: TextValue


class Options(StrictModel):
    options: list[Item] = Field(min_length=2)


class SingleKey(StrictModel):
    correct_option_id: Identifier


class BooleanKey(StrictModel):
    value: StrictBool


class TextKey(StrictModel):
    accepted_answers: list[TextValue] = Field(min_length=1)
    case_sensitive: bool = False


class Blanks(StrictModel):
    blank_ids: list[Identifier] = Field(min_length=1)


class BlankKey(StrictModel):
    accepted_answers: dict[Identifier, list[TextValue]]


class SelectKey(StrictModel):
    correct_option_ids: list[Identifier] = Field(min_length=1)


class FlashContent(StrictModel):
    cue: TextValue


class FlashKey(StrictModel):
    back: TextValue
    scoring_rubric_version: TextValue | None = None


class Tokens(StrictModel):
    tokens: list[Item] = Field(min_length=1)


class ErrorKey(StrictModel):
    error_token_ids: list[Identifier] = Field(min_length=1)
    accepted_corrections: dict[Identifier, list[TextValue]] = Field(default_factory=dict)


class Arrangement(StrictModel):
    items: list[Item] = Field(min_length=2)


class OrderKey(StrictModel):
    ordered_ids: list[Identifier] = Field(min_length=2)


class Matching(StrictModel):
    left: list[Item] = Field(min_length=2)
    right: list[Item] = Field(min_length=2)


class Pair(StrictModel):
    left_id: Identifier
    right_id: Identifier


class MatchingKey(StrictModel):
    pairs: list[Pair] = Field(min_length=2)


CONFIG_MODELS = {
    "multiple_choice": (Options, SingleKey),
    "true_false": (EmptyContent, BooleanKey),
    "identification": (EmptyContent, TextKey),
    "fill_in_the_blank": (Blanks, BlankKey),
    "multiple_select": (Options, SelectKey),
    "flashcards": (FlashContent, FlashKey),
    "error_identification": (Tokens, ErrorKey),
    "word_arrangement": (Arrangement, OrderKey),
    "sentence_arrangement": (Arrangement, OrderKey),
    "matching_type": (Matching, MatchingKey),
}


def unique(values: list[str]) -> set[str]:
    if len(values) != len(set(values)):
        raise ValueError("Duplicate configuration identifiers")
    return set(values)


def validate_content(method: str, content: dict) -> StrictModel:
    if method not in CONFIG_MODELS:
        raise ValueError("Unsupported answer method")
    result = CONFIG_MODELS[method][0].model_validate(content)
    for field in ("options", "tokens", "items", "left", "right"):
        if hasattr(result, field):
            unique([item.id for item in getattr(result, field)])
    if isinstance(result, Blanks):
        unique(result.blank_ids)
    return result


def validate_definition(method: str, content: dict, answer_key: dict) -> None:
    public = validate_content(method, content)
    private = CONFIG_MODELS[method][1].model_validate(answer_key)
    if isinstance(public, Options):
        available = {item.id for item in public.options}
        selected = [private.correct_option_id] if isinstance(private, SingleKey) else private.correct_option_ids
        if not unique(selected) <= available:
            raise ValueError("Answer key references unknown options")
    elif isinstance(public, Blanks):
        if set(private.accepted_answers) != set(public.blank_ids) or any(
            not answers for answers in private.accepted_answers.values()
        ):
            raise ValueError("Every blank needs accepted answers")
    elif isinstance(public, Tokens):
        available = {item.id for item in public.tokens}
        if not unique(private.error_token_ids) <= available or not set(private.accepted_corrections) <= available:
            raise ValueError("Unknown error token")
    elif isinstance(public, Arrangement):
        if unique(private.ordered_ids) != {item.id for item in public.items}:
            raise ValueError("Ordering must be a permutation of all item identifiers")
    elif isinstance(public, Matching):
        if unique([pair.left_id for pair in private.pairs]) != {item.id for item in public.left}:
            raise ValueError("Matching must cover each left identifier once")
        if unique([pair.right_id for pair in private.pairs]) != {item.id for item in public.right}:
            raise ValueError("Matching must cover each right identifier once")


class ChoiceAnswer(StrictModel):
    option_id: Identifier


class TextAnswer(StrictModel):
    text: TextValue


class BlankAnswer(StrictModel):
    blank_id: Identifier
    text: TextValue


class BlanksAnswer(StrictModel):
    blanks: list[BlankAnswer]


class SelectAnswer(StrictModel):
    option_ids: list[Identifier]


class FlashAnswer(StrictModel):
    recall: Literal["again", "hard", "good", "easy"]


class ErrorAnswer(StrictModel):
    selected_token_ids: list[Identifier]
    correction: TextValue | None = None


class WordAnswer(StrictModel):
    ordered_token_ids: list[Identifier]


class SentenceAnswer(StrictModel):
    ordered_sentence_ids: list[Identifier]


class MatchingAnswer(StrictModel):
    pairs: list[Pair]


RESPONSE_MODELS = {
    "multiple_choice": ChoiceAnswer,
    "true_false": BooleanKey,
    "identification": TextAnswer,
    "fill_in_the_blank": BlanksAnswer,
    "multiple_select": SelectAnswer,
    "flashcards": FlashAnswer,
    "error_identification": ErrorAnswer,
    "word_arrangement": WordAnswer,
    "sentence_arrangement": SentenceAnswer,
    "matching_type": MatchingAnswer,
}


def validate_response(method: str, content: dict, answer: dict) -> None:
    """Allow structurally valid partial drafts; completeness and grading are future services."""
    public = validate_content(method, content)
    response = RESPONSE_MODELS[method].model_validate(answer)
    selected, available = None, None
    if isinstance(public, Options):
        available = {item.id for item in public.options}
        selected = [response.option_id] if isinstance(response, ChoiceAnswer) else response.option_ids
    elif isinstance(public, Blanks):
        available = set(public.blank_ids)
        selected = [blank.blank_id for blank in response.blanks]
    elif isinstance(public, Tokens):
        available = {item.id for item in public.tokens}
        selected = response.selected_token_ids
    elif isinstance(public, Arrangement):
        available = {item.id for item in public.items}
        selected = response.ordered_token_ids if isinstance(response, WordAnswer) else response.ordered_sentence_ids
    elif isinstance(public, Matching):
        if not unique([pair.left_id for pair in response.pairs]) <= {item.id for item in public.left}:
            raise ValueError("Unknown matching left identifier")
        if not unique([pair.right_id for pair in response.pairs]) <= {item.id for item in public.right}:
            raise ValueError("Unknown matching right identifier")
    if selected is not None and not unique(selected) <= available:
        raise ValueError("Answer references unknown identifiers")
