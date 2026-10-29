import tempfile
import wave
from math import gcd
from pathlib import Path

from common import ArtifactRuntime, create_worker_app


class WavLMRuntime(ArtifactRuntime):
    def __init__(self):
        super().__init__("assessment")

    def capability(self):
        import psutil

        if self.model is None and psutil.virtual_memory().available < 4 * 1024**3:
            raise ValueError("insufficient_memory")
        return super().capability()

    def infer(self, recording, reference):
        import numpy as np
        from scipy.signal import resample_poly

        from .pipeline import PronunciationAssessorV2

        identity = self.identity()
        if self.model is None:
            self.model = PronunciationAssessorV2(self.manifest.root)
        samples = np.frombuffer(recording.pcm_le, dtype="<i2").astype(np.float32)
        if recording.sample_rate_hz != 16000:
            divisor = gcd(recording.sample_rate_hz, 16000)
            samples = resample_poly(
                samples, 16000 // divisor, recording.sample_rate_hz // divisor
            )
        pcm = np.clip(np.rint(samples), -32768, 32767).astype("<i2").tobytes()
        # The candidate scorer accepts WAV paths. This bounded request directory
        # is removed on success and failure; it is never an upload/history store.
        with tempfile.TemporaryDirectory(prefix="fluentt-speech-") as directory:
            path = Path(directory) / "audio.wav"
            with wave.open(str(path), "wb") as target:
                target.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
                target.writeframes(pcm)
            raw = self.model.assess(str(path), reference)
        if raw.get("error"):
            raise ValueError("assessment_unavailable")
        words = [
            {
                "word": w["word"],
                "score": float(w["score"]),
                "phonemes": [
                    {
                        "phone": p["phone"],
                        "score": float(p["score"]),
                        "pherr_prob": float(p["pherr_prob"]),
                        "error": p["error"],
                    }
                    for p in w["phonemes"]
                ],
            }
            for w in raw["words"]
        ]
        return {
            **identity,
            "overall_score": float(raw["overall_score"]),
            "n_errors": raw["n_errors"],
            "words": words,
        }


app = create_worker_app("assessment", WavLMRuntime())
