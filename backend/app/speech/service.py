import re
from dataclasses import dataclass
from difflib import SequenceMatcher

from fastapi import HTTPException

from app.content.models import ContentRelease
from app.content.provenance import resolve_review_content
from app.speech.schemas import WordMatch


@dataclass(frozen=True)
class SpeechTarget:
    text: str
    language: str


def reference_words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?", text.replace("’", "'"))


def resolve_speech_target(db, item_id, revision_id, release_id) -> SpeechTarget:
    try:
        revision = resolve_review_content(db, item_id, revision_id, release_id)
        release = db.get(ContentRelease, release_id)
        text = revision.term.replace("’", "'")
        words = reference_words(text)
        if (
            not 1 <= len(words) <= 60
            or any(len(w) > 100 for w in words)
            or re.search(r"[^A-Za-z' .,!?;:\-]", text)
        ):
            raise HTTPException(422, "Speech practice is unavailable for this word.")
        return SpeechTarget(text, release.language_code)
    finally:
        # Copy immutable facts before rollback; never hold a DB transaction during inference.
        db.rollback()


def align_transcript(target: str, transcript: str, final: bool) -> list[WordMatch]:
    expected = reference_words(target)
    heard = re.findall(
        r"\[unclear\]|[A-Za-z]+(?:'[A-Za-z]+)?", transcript.replace("’", "'")
    )
    result = [
        WordMatch(
            target_index=i,
            expected_word=word,
            recognized_word=None,
            state="mismatch" if final else "pending",
        )
        for i, word in enumerate(expected)
    ]
    matcher = SequenceMatcher(
        None,
        [w.casefold() for w in expected],
        [w.casefold() for w in heard],
        autojunk=False,
    )
    for operation, start, end, heard_start, heard_end in matcher.get_opcodes():
        if operation == "equal":
            for offset in range(end - start):
                result[start + offset].recognized_word = heard[heard_start + offset]
                result[start + offset].state = "match"
        elif operation == "replace":
            for i, word in zip(range(start, end), heard[heard_start:heard_end]):
                result[i].recognized_word = word
    return result
