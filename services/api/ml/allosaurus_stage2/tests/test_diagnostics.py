"""Deterministic/synthetic checks; no human pronunciation labels or model load."""
import itertools
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
import wave

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from allosaurus_stage2.audio import validate_audio
from allosaurus_stage2.decoder import PhoneDecoder
from allosaurus_stage2.metrics import phone_errors, evaluate
from allosaurus.lm.decoder import PhoneDecoder as Original


class Mask:
    def mask_logits(self, value):
        return value

    def get_units(self, ids):
        return ["<blk>" if x == 0 else "ab"[x - 1] for x in ids]


def decoder(kind):
    value = kind.__new__(kind)
    value.config = SimpleNamespace(approximate=False, window_shift=.03, window_size=.045)
    value.inventory = SimpleNamespace(get_mask=lambda *a, **k: Mask())
    return value


def logits(path):
    value = np.full((len(path), 3), -20., dtype=np.float32)
    for i, label in enumerate(path):
        value[i, label] = 0
    return value


class DecoderTests(unittest.TestCase):
    def test_original_defect_reproduced(self):
        self.assertEqual(decoder(Original).compute(logits([1, 0, 1])), "a")
        self.assertEqual(decoder(PhoneDecoder).compute(logits([1, 0, 1])), "a a")

    def test_exhaustive_ctc_oracle_through_seven_frames(self):
        fixed = decoder(PhoneDecoder)
        for size in range(8):
            for path in itertools.product(range(3), repeat=size):
                collapsed = [label for label, _ in itertools.groupby(path) if label]
                expected = " ".join("ab"[label - 1] for label in collapsed)
                self.assertEqual(fixed.compute(logits(path)), expected, path)

    def test_no_artificial_repetitions_and_short_blank_paths(self):
        for path, expected in [([1, 1, 1], "a"), ([1], "a"), ([], ""), ([0, 0], ""),
                               ([1, 0, 0, 1], "a a"), ([1, 2, 1], "a b a")]:
            self.assertEqual(decoder(PhoneDecoder).compute(logits(path)), expected)

    def test_repeated_emission_timestamps_and_topk(self):
        value = decoder(PhoneDecoder).compute(logits([1, 0, 1]), topk=2, timestamp=True).splitlines()
        self.assertEqual(len(value), 2)
        self.assertTrue(value[0].startswith("0.000 0.045 a"))
        self.assertTrue(value[1].startswith("0.060 0.045 a"))


class AudioTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "audio.wav"

    def tearDown(self):
        self.temp.cleanup()

    def wav(self, duration=1., rate=8000, channels=1, width=2, silent=False, amplitude=4000):
        data = np.zeros(round(rate * duration), dtype="<i2") if silent else (
            amplitude * np.sin(2 * np.pi * 220 * np.arange(round(rate * duration)) / rate)).astype("<i2")
        with wave.open(str(self.path), "wb") as output:
            output.setparams((channels, width, rate, 0, "NONE", "not compressed"))
            output.writeframes(data.tobytes())

    def test_valid_short_boundary_and_regular_audio(self):
        for seconds in [.5, .6, 1., 30.]:
            self.wav(duration=seconds)
            self.assertAlmostEqual(validate_audio(self.path)["duration_s"], seconds)

    def test_short_empty_long_audio(self):
        for seconds in [0, .1, .499, 30.1]:
            self.wav(duration=seconds)
            with self.assertRaises(ValueError):
                validate_audio(self.path)

    def test_silence_and_near_silence(self):
        for kwargs in [{"silent": True}, {"amplitude": 1}]:
            self.wav(**kwargs)
            with self.assertRaisesRegex(ValueError, "silent"):
                validate_audio(self.path)

    def test_invalid_formats_and_truncation(self):
        for kwargs in [{"rate": 16000}, {"channels": 2}, {"width": 1}]:
            self.wav(**kwargs)
            with self.assertRaises(ValueError):
                validate_audio(self.path)
        self.wav()
        self.path.write_bytes(self.path.read_bytes()[:-20])
        with self.assertRaises(ValueError):
            validate_audio(self.path)
        for bad in [b"", b"not wave", b"RIFF\x00\x00\x00\x00WAVE"]:
            self.path.write_bytes(bad)
            with self.assertRaises(ValueError):
                validate_audio(self.path)


class MetricsTests(unittest.TestCase):
    def test_exact_substitution_deletion_insertion(self):
        cases = [(["a"], ["a"], (0, 0, 0)), (["n"], ["ŋ"], (1, 0, 0)),
                 (["a", "ʔ"], ["a"], (0, 1, 0)), (["a"], ["a", "a"], (0, 0, 1)),
                 (["a", "b"], ["b", "a"], (2, 0, 0))]
        for ref, hyp, expected in cases:
            result = phone_errors(ref, hyp)
            self.assertEqual(tuple(result[k] for k in ["substitutions", "deletions", "insertions"]), expected)
            self.assertEqual(result["errors"], sum(expected))

    def test_unicode_tokens_and_empty_reference(self):
        self.assertEqual(phone_errors(["t͡ʃ", "ã"], ["t͡ʃ", "ã"])["errors"], 0)
        self.assertEqual(phone_errors(["a", "a"], ["aː"])["errors"], 2)
        self.assertEqual(phone_errors(["a"], [])["deletions"], 1)
        for ref in [[], "a b", ["a b"]]:
            with self.assertRaises(ValueError):
                phone_errors(ref, ["a"])

    def test_not_accepting_generated_or_missing_gold(self):
        with self.assertRaises(ValueError):
            evaluate([])
        with self.assertRaises(ValueError):
            evaluate([{"id": "synthetic", "annotation": {"kind": "g2p"}}])

    def test_synthetic_micro_aggregation_and_duplicate_ids(self):
        annotation = {"kind": "human_audio_transcription", "model_blind": True,
                      "source_url": "synthetic-test-only", "license": "synthetic", "annotator_protocol": "synthetic",
                      "audio_sha256": "0" * 64, "speaker_id": "synthetic"}
        rows = [{"id": "synthetic-1", "annotation": annotation, "reference_phones": ["a"], "hypothesis_phones": []},
                {"id": "synthetic-2", "annotation": annotation, "reference_phones": ["a", "b", "a"],
                 "hypothesis_phones": ["a", "b", "a"]}]
        result = evaluate(rows)
        self.assertEqual(result["micro_per"], .25)
        self.assertEqual(result["deletions"], 1)
        with self.assertRaises(ValueError):
            evaluate([rows[0], rows[0]])


if __name__ == "__main__":
    unittest.main()
