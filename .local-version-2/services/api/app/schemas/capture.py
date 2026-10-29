"""Versioned unscored draft capture. Text buffers remain raw, including incomplete text."""

from app.schemas.question_config import validate_content, validate_response

CONTRACT = "unscored-capture-v1"


def validate_capture(method, content, answer):
    public = validate_content(method, content)
    if method in {"identification", "fill_in_the_blank"}:
        if not isinstance(answer, dict):
            raise ValueError("Expected a response object")
        if method == "identification":
            if set(answer) != {"text"}:
                raise ValueError("Expected a raw text response")
            values = [answer["text"]]
        else:
            if set(answer) != {"blanks"} or not isinstance(answer["blanks"], list):
                raise ValueError("Expected gap responses")
            ids, values = [], []
            for entry in answer["blanks"]:
                if (
                    not isinstance(entry, dict)
                    or set(entry) != {"blank_id", "text"}
                    or not isinstance(entry["blank_id"], str)
                ):
                    raise ValueError("Invalid gap response")
                ids.append(entry["blank_id"])
                values.append(entry["text"])
            if len(ids) != len(set(ids)) or not set(ids) <= set(public.blank_ids):
                raise ValueError("Duplicate or unknown gap")
        limit = public.input_max_length or 8000  # Operational ceiling for legacy content, not a grading rule.
        if any(not isinstance(value, str) or len(value) > limit for value in values):
            raise ValueError("Invalid text or input length")
        for value in values:
            value.encode("utf-8")  # Reject isolated surrogates without normalizing valid Unicode.
    else:
        validate_response(method, content, answer)
        if method == "error_identification" and "correction" in answer:
            raise ValueError("Correction entry is not part of this capture contract")


def complete(method, content, answer):
    if answer is None:
        return False
    if method == "identification":
        return bool(answer["text"].strip())
    if method == "fill_in_the_blank":
        return {entry["blank_id"] for entry in answer["blanks"] if entry["text"].strip()} == set(content["blank_ids"])
    if method == "multiple_select":
        return bool(answer["option_ids"])
    if method == "error_identification":
        return bool(answer["selected_token_ids"])
    if method in {"word_arrangement", "sentence_arrangement"}:
        key = "ordered_token_ids" if method == "word_arrangement" else "ordered_sentence_ids"
        return len(answer[key]) == len(content["items"])
    if method == "matching_type":
        return len(answer["pairs"]) == len(content["left"])
    return True
