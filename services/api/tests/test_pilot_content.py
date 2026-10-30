from collections import Counter

from app.modules.questions.pilot_content import LESSONS, definitions


def test_pilot_definitions_and_arrangements_are_complete():
    authored = [item for lesson in LESSONS for item in definitions(lesson)]
    assert len(authored) == 37
    assert Counter(item.method for item in authored) == {"multiple_choice": 13, "word_arrangement": 9, "flashcards": 15}
    for lesson in LESSONS:
        assert lesson["introduction"] and lesson["source_url"].startswith("https://www.youtube.com/")
        for item in definitions(lesson):
            assert item.language == "english"
            if item.method == "word_arrangement":
                assert [token.id for token in item.content.items] != item.answer_key.ordered_ids
                target = {token.id: token.text for token in item.content.items}
                assert " ".join(target[key] for key in item.answer_key.ordered_ids) == item.explanation
