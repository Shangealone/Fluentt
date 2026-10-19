"""Converter contract tests: pure verification oracles + guarded integration bits.

Tests that require real ffmpeg/ffprobe executables are skipped automatically
when the executables are not installed on this machine.
"""

import io
import shutil
import sys
import wave
from pathlib import Path

import pytest

from app.pronunciation import converter

HAS_FFMPEG = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def _valid_wav_bytes(
    *,
    sample_rate: int = 16_000,
    channels: int = 1,
    width: int = 2,
    frames: int = 16_000,
) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setnchannels(channels)
        writer.setsampwidth(width)
        writer.setframerate(sample_rate)
        writer.writeframes(b"\x00" * (frames * channels * width))
    return buffer.getvalue()


def test_verify_canonical_wav_accepts_bounded_16k_mono_pcm() -> None:
    verified = converter.verify_canonical_wav(_valid_wav_bytes())
    assert verified == {
        "frame_count": 16_000,
        "sample_rate": 16_000,
        "channels": 1,
        "sample_width_bytes": 2,
    }


def test_verify_canonical_wav_rejects_wrong_rate_channels_width() -> None:
    for kwargs in (
        {"sample_rate": 44_100},
        {"channels": 2},
        {"width": 1},
    ):
        with pytest.raises(converter.ConverterUnavailable):
            converter.verify_canonical_wav(_valid_wav_bytes(**kwargs))


def test_verify_canonical_wav_rejects_empty_and_oversized() -> None:
    with pytest.raises(converter.ConverterUnavailable):
        converter.verify_canonical_wav(b"")
    with pytest.raises(converter.ConverterUnavailable):
        converter.verify_canonical_wav(bytes(converter.TEMP_OUTPUT_CAP_BYTES + 1))


def test_verify_canonical_wav_rejects_more_than_ten_seconds() -> None:
    with pytest.raises(converter.DurationLimitExceeded):
        converter.verify_canonical_wav(
            _valid_wav_bytes(frames=converter.MAX_PCM_FRAMES + 1)
        )


def test_convert_rejects_empty_upload_before_any_executable() -> None:
    with pytest.raises(converter.UnsupportedAudio):
        converter.convert_to_wav(
            b"",
            ffmpeg_path="ffmpeg-does-not-exist",
            ffprobe_path="ffprobe-does-not-exist",
        )


def test_missing_executables_are_configuration_faults_not_learner_faults() -> None:
    with pytest.raises(converter.ConverterUnavailable):
        converter.convert_to_wav(
            b"not-really-m4a",
            ffmpeg_path="definitely-not-installed-ffmpeg",
            ffprobe_path="definitely-not-installed-ffprobe",
        )


def test_convert_rejects_garbage_input_with_ffprobe() -> None:
    if not HAS_FFMPEG:
        pytest.skip("ffmpeg/ffprobe not installed on this machine")
    with pytest.raises(converter.UnsupportedAudio):
        converter.convert_to_wav(
            b"this is not a media container",
            ffmpeg_path="ffmpeg",
            ffprobe_path="ffprobe",
        )


def test_converter_profile_constants_are_frozen() -> None:
    assert converter.MAX_SOURCE_DURATION_SECONDS == 10.0
    assert converter.ALLOWED_MIME_TYPES == {"audio/mp4", "audio/m4a", "audio/x-m4a"}
    assert converter.MAX_PCM_FRAMES == 160_000


def test_cleanup_orphan_jobs_only_removes_old_job_directories(tmp_path: Path) -> None:
    old_job = tmp_path / "job-old"
    old_job.mkdir()
    fresh_job = tmp_path / "job-new"
    fresh_job.mkdir()
    unrelated = tmp_path / "other"
    unrelated.mkdir()
    import os
    import time

    stale = time.time() - 3_600
    os.utime(old_job, (stale, stale))
    removed = converter.cleanup_orphan_jobs(str(tmp_path), max_age_seconds=300)
    assert removed == 1
    assert not old_job.exists()
    assert fresh_job.exists()
    assert unrelated.exists()


def test_subprocess_output_is_capped_during_reading():
    with pytest.raises(converter.ConverterUnavailable, match="output exceeded"):
        converter._run_bounded(
            [sys.executable, "-c", "import sys; sys.stdout.write('x' * 1000000)"],
            timeout=2,
            output_cap=8192,
        )


def test_subprocess_is_terminated_on_deadline():
    with pytest.raises(converter.ConverterUnavailable, match="timed out"):
        converter._run_bounded(
            [sys.executable, "-c", "import time; time.sleep(30)"], timeout=0.1
        )


@pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg/ffprobe not installed")
def test_real_aac_conversion_and_job_cleanup(tmp_path: Path):
    import subprocess

    source = tmp_path / "test.m4a"
    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=1",
            "-c:a",
            "aac",
            str(source),
        ],
        check=True,
        capture_output=True,
        timeout=10,
    )
    jobs = tmp_path / "jobs"
    result = converter.convert_to_wav(
        source.read_bytes(),
        ffmpeg_path="ffmpeg",
        ffprobe_path="ffprobe",
        workspace_root=str(jobs),
    )
    assert (result.sample_rate, result.channels, result.sample_width_bytes) == (
        16000,
        1,
        2,
    )
    assert result.frame_count == 16000
    assert list(jobs.iterdir()) == []
