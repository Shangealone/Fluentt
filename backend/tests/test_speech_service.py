from app.speech.service import align_transcript


def test_provisional_words_can_remain_pending_and_final_missing_words_are_mismatches():
    assert [w.state for w in align_transcript("hello world", "hello", False)] == [
        "match",
        "pending",
    ]
    assert [w.state for w in align_transcript("hello world", "hello", True)] == [
        "match",
        "mismatch",
    ]


def test_alignment_handles_insertion_without_shifting_later_matches():
    result = align_transcript("hello world", "hello beautiful world", True)
    assert [w.state for w in result] == ["match", "match"]
