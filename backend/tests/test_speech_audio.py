import struct

import pytest

from app.speech.audio import parse_pcm16


def pcm(rate=16000, seconds=1):
    return struct.pack("<h", 1200) * (rate * seconds)


@pytest.mark.parametrize("rate", [8000, 16000, 48000])
def test_accepts_actual_sample_rate_and_ten_second_limit(rate):
    result = parse_pcm16(pcm(rate, 10), rate, 1)
    assert result.duration_ms == 10000
    assert result.sample_rate_hz == rate
    assert result.pcm_le == pcm(rate, 10)


@pytest.mark.parametrize(
    "body,rate,channels",
    [
        (b"", 16000, 1),
        (b"1", 16000, 1),
        (pcm(), 16000, 2),
        (pcm(), 7999, 1),
        (pcm(), 48001, 1),
        (pcm(16000, 11), 16000, 1),
        (b"00" * 500001, 48000, 1),
        (b"\0\0" * 16000, 16000, 1),
    ],
    ids=[
        "empty",
        "odd-bytes",
        "stereo",
        "low-rate",
        "high-rate",
        "long",
        "oversized",
        "silent",
    ],
)
def test_rejects_invalid_audio(body, rate, channels):
    with pytest.raises(ValueError):
        parse_pcm16(body, rate, channels)
