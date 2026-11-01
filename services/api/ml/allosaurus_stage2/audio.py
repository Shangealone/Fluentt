"""GPL-3.0. Bounded diagnostic PCM input, separate from production audio code."""
from pathlib import Path
import wave

import numpy as np


def validate_audio(path):
    path = Path(path)
    if not path.is_file() or path.stat().st_size > 484096:
        raise ValueError("invalid_audio")
    try:
        with wave.open(str(path), "rb") as source:
            rate = source.getframerate()
            frames = source.getnframes()
            if (source.getnchannels(), source.getsampwidth(), rate, source.getcomptype()) != (1, 2, 8000, "NONE"):
                raise ValueError("invalid_audio")
            if not 4000 <= frames <= 240000:
                raise ValueError("invalid_audio_duration")
            data = source.readframes(frames + 1)
            if len(data) != frames * 2:
                raise ValueError("invalid_audio")
    except (wave.Error, EOFError, OSError) as error:
        raise ValueError("invalid_audio") from error
    samples = np.frombuffer(data, dtype="<i2").astype(np.float64)
    rms = float(np.sqrt(np.mean(samples * samples)))
    if rms < 32:
        raise ValueError("silent_or_near_silent_audio")
    return {"duration_s": frames / rate, "rms_pcm16": rms, "frames": frames, "rate": rate}
