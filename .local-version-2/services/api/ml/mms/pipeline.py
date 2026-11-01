"""Offline Tagalog CTC transcription; no reference text enters the neural model."""
from pathlib import Path
import time


class Transcriber:
    def __init__(self, cache, device="cpu"):
        self.cache = str(Path(cache).resolve())
        self.device = device
        self.model = None
        self.processor = None

    def load(self):
        if self.model is not None:
            return
        from artifacts import manifest
        import psutil
        from artifacts import MIN_FREE_BYTES
        if psutil.virtual_memory().available < MIN_FREE_BYTES:
            raise ValueError("insufficient_memory")
        manifest(self.cache, verify=True)
        import torch
        from transformers import Wav2Vec2ForCTC, AutoProcessor
        if self.device != "cpu" and not torch.cuda.is_available():
            raise ValueError("GPU unavailable")
        torch.set_num_threads(2)
        processor = AutoProcessor.from_pretrained(self.cache, target_lang="tgl", local_files_only=True, trust_remote_code=False)
        processor.tokenizer.set_target_lang("tgl")
        model = Wav2Vec2ForCTC.from_pretrained(
            self.cache, local_files_only=True, use_safetensors=True,
        )
        # First load the unchanged base vocabulary/head. Then the native adapter loader
        # strictly replaces the language head and adapter together, without globally
        # ignoring mismatched checkpoint sizes or retaining a randomly initialized head.
        model.load_adapter("tgl", local_files_only=True, use_safetensors=True)
        if model.target_lang != "tgl" or processor.tokenizer.target_lang != "tgl":
            raise ValueError("Tagalog adapter unavailable")
        model.to(self.device).eval()
        self.processor, self.model = processor, model

    def transcribe(self, samples):
        import torch
        started = time.perf_counter()
        inputs = self.processor(samples, sampling_rate=16000, return_tensors="pt")
        inputs = {name: value.to(self.device) for name, value in inputs.items()}
        with torch.inference_mode():
            logits = self.model(**inputs).logits
        text = self.processor.batch_decode(logits.argmax(dim=-1))[0].strip()
        if not text:
            raise ValueError("no_speech")
        return {
            "transcript": text, "confidence": None, "confidence_status": "unavailable_uncalibrated",
            "duration_ms": round(len(samples) / 16),
            "processing_duration_ms": round((time.perf_counter() - started) * 1000),
        }
