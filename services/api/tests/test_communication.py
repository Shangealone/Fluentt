from datetime import datetime
import pytest
from pydantic import ValidationError
from app.modules.communications.schemas import Send, Query


@pytest.mark.parametrize("content", ["", " \t\n\u2003", "a" * 4001, "\x00", "\ud800", 1])
def test_bad_text(content):
    with pytest.raises(ValidationError):
        Send(content=content)


def test_raw_unicode_and_bounded_filters():
    text = "  Kumusta? ñ 😀\n<script>literal</script>  "
    assert Send(content=text).content == text
    assert Send(content="😀" * 4000).content == "😀" * 4000
    for params in ({"limit": 101}, {"offset": -1}, {"recipient_id": "anything"}, {"before": datetime(2026, 10, 19)}):
        with pytest.raises(ValidationError):
            Query(**params)
