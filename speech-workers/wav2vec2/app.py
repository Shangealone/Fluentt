import json

from common import ArtifactRuntime, create_worker_app


class Wav2Vec2Runtime(ArtifactRuntime):
    def __init__(self):
        super().__init__("recognition")

    def infer(self, recording, reference):
        from math import gcd

        import numpy as np
        import torch
        from scipy.signal import resample_poly
        from transformers import Wav2Vec2FeatureExtractor, Wav2Vec2ForCTC

        from .ctc_decoder import prefix_beam_search
        from .word_decoder import decode_words

        identity = self.identity()
        root = self.manifest.root
        if self.model is None:
            self.feature = Wav2Vec2FeatureExtractor.from_pretrained(
                root, local_files_only=True
            )
            self.model = Wav2Vec2ForCTC.from_pretrained(
                root,
                local_files_only=True,
                weights_only=True,
                trust_remote_code=False,
            ).eval()
            self.vocab = {
                value: key
                for key, value in json.loads((root / "vocab.json").read_text()).items()
            }
            torch.set_num_threads(2)
        samples = (
            np.frombuffer(recording.pcm_le, dtype="<i2").astype(np.float32) / 32768.0
        )
        if recording.sample_rate_hz != 16000:
            divisor = gcd(recording.sample_rate_hz, 16000)
            samples = resample_poly(
                samples, 16000 // divisor, recording.sample_rate_hz // divisor
            )
        inputs = self.feature(samples, sampling_rate=16000, return_tensors="pt")
        with torch.inference_mode():
            logits = self.model(**inputs).logits[0]
            ids = prefix_beam_search(
                logits.log_softmax(dim=-1).tolist(),
                blank_id=self.model.config.pad_token_id,
                forbidden_ids=(1, 2, 3),
            )
        phonemes = " ".join(self.vocab[token] for token in ids)
        decoded = decode_words(phonemes, "english")
        transcript = decoded.get("text")
        if not isinstance(transcript, str) or decoded.get("status") != "candidate":
            raise ValueError("No recognizable speech")
        return {
            **identity,
            "transcript": transcript,
            "decoder_version": "ctc-prefix-beam-v1/phoneme-lexicon-v1",
        }


app = create_worker_app("recognition", Wav2Vec2Runtime())
