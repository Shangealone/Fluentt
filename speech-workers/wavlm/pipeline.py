"""Reviewed adaptation of Jianshu001/wavlm-phoneme-scorer pipeline_v2.py.
Upstream revision 19f6b9675d02a61dcd5b2aec0fdcc4364c1fc9da; upstream metadata: MIT.
Architecture/alignment/scoring originate from that source. Local changes: restricted loading,
offline pinned artifacts, strict state/coverage, WAV-only input and inference-mode execution.
No upstream Python is downloaded or executed at runtime. See NOTICE.md and WAVLM_INTEGRATION.md.
"""

import json
import re
import wave
from pathlib import Path

import numpy as np
import torch
from torch import nn
from transformers import (
    Wav2Vec2FeatureExtractor,
    Wav2Vec2ForCTC,
    WavLMConfig,
    WavLMModel,
)

SAMPLE_RATE = 16000
ARPABET_TO_IPA = {
    "aa": ["ɑː", "ɑ", "ɒ", "a"],
    "ae": ["æ"],
    "ah": ["ʌ", "ə", "ɐ"],
    "ao": ["ɔː", "ɔ", "ɒ"],
    "aw": ["aʊ"],
    "ax": ["ə", "ɐ", "ʌ"],
    "ay": ["aɪ"],
    "b": ["b"],
    "ch": ["tʃ"],
    "d": ["d"],
    "dh": ["ð"],
    "eh": ["ɛ", "e"],
    "er": ["ɜː", "ɝ", "ɚ", "ɜ"],
    "ey": ["eɪ"],
    "f": ["f"],
    "g": ["ɡ", "g"],
    "hh": ["h"],
    "ih": ["ɪ", "ᵻ"],
    "iy": ["iː", "i"],
    "ir": ["ɪɹ"],
    "jh": ["dʒ"],
    "k": ["k"],
    "l": ["l"],
    "m": ["m"],
    "n": ["n"],
    "ng": ["ŋ"],
    "ow": ["oʊ", "o", "əʊ"],
    "oy": ["ɔɪ"],
    "p": ["p"],
    "r": ["ɹ", "r"],
    "s": ["s"],
    "sh": ["ʃ"],
    "t": ["t"],
    "th": ["θ"],
    "uh": ["ʊ"],
    "uw": ["uː", "u"],
    "ur": ["ʊɹ"],
    "v": ["v"],
    "w": ["w"],
    "y": ["j"],
    "z": ["z"],
    "zh": ["ʒ"],
    "ar": ["ɑːɹ"],
    "oo": ["ʊ", "uː"],
    "dr": ["dɹ"],
    "tr": ["tɹ"],
    "ts": ["ts"],
    "dz": ["dz"],
}


ALL_PHONES = sorted(ARPABET_TO_IPA.keys())


PHONE_TO_ID = {ph: i for i, ph in enumerate(ALL_PHONES)}


N_PHONE_TYPES = len(ALL_PHONES)


class PhoneScorerHead(nn.Module):
    def __init__(
        self,
        hidden_dim=1024,
        n_phone_types=N_PHONE_TYPES,
        phone_emb_dim=32,
        mlp_dim=512,
    ):
        super().__init__()
        self.phone_emb = nn.Embedding(n_phone_types, phone_emb_dim)
        input_dim = hidden_dim + phone_emb_dim + 2  # +2 for GOP and n_frames

        self.shared = nn.Sequential(
            nn.Linear(input_dim, mlp_dim),
            nn.BatchNorm1d(mlp_dim),
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(mlp_dim, mlp_dim),
            nn.BatchNorm1d(mlp_dim),
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(mlp_dim, 256),
            nn.BatchNorm1d(256),
            nn.GELU(),
            nn.Dropout(0.2),
        )
        self.score_head = nn.Sequential(nn.Linear(256, 64), nn.GELU(), nn.Linear(64, 1))
        self.pherr_head = nn.Sequential(nn.Linear(256, 64), nn.GELU(), nn.Linear(64, 1))

    def forward(self, h, phone_id, gop, n_frames):
        emb = self.phone_emb(phone_id)
        x = torch.cat([h, emb, gop.unsqueeze(-1), n_frames.unsqueeze(-1)], dim=-1)
        shared = self.shared(x)
        score = self.score_head(shared).squeeze(-1)
        pherr_logit = self.pherr_head(shared).squeeze(-1)
        return score, pherr_logit


class PronunciationAssessorV2:
    def __init__(self, cache, device="cpu", pherr_threshold=0.70):
        self.cache = Path(cache)
        self.device = device
        self.pherr_threshold = pherr_threshold
        self._loaded = False

    def _load_models(self):
        if self._loaded:
            return
        import nltk

        nltk.data.path.insert(0, str(self.cache / "nltk_data"))
        # Preflight every resource before importing G2P; no automatic network/resource download.
        for item in (
            "corpora/cmudict.zip",
            "taggers/averaged_perceptron_tagger.zip",
            "taggers/averaged_perceptron_tagger_eng/",
        ):
            nltk.data.find(item)
        from g2p_en import G2p

        with torch.serialization.safe_globals(
            [
                np._core.multiarray.scalar,
                np.dtype,
                np.dtypes.Float64DType,
                np.dtypes.Float32DType,
            ]
        ):
            checkpoint = torch.load(
                self.cache / "scorer/wavlm_finetuned.pt",
                map_location="cpu",
                weights_only=True,
                mmap=True,
            )
        state = checkpoint["model_state"]
        if (
            not isinstance(state, dict)
            or not state
            or not all(
                isinstance(k, str) and isinstance(v, torch.Tensor)
                for k, v in state.items()
            )
        ):
            raise ValueError("Invalid checkpoint state")
        backbone = {
            k[len("backbone.") :]: v
            for k, v in state.items()
            if k.startswith("backbone.")
        }
        head = {k: v for k, v in state.items() if not k.startswith("backbone.")}
        config = WavLMConfig.from_pretrained(
            self.cache / "backbone", local_files_only=True
        )
        config.mask_time_prob = 0.0
        self._backbone = WavLMModel(config)
        self._backbone.load_state_dict(backbone, strict=True)
        self._backbone.to(self.device).eval()
        self._scorer = PhoneScorerHead()
        self._scorer.load_state_dict(head, strict=True)
        self._scorer.to(self.device).eval()
        self._fe_backbone = Wav2Vec2FeatureExtractor.from_pretrained(
            self.cache / "backbone", local_files_only=True
        )
        self._ctc_model = (
            Wav2Vec2ForCTC.from_pretrained(
                self.cache / "alignment", local_files_only=True, weights_only=True
            )
            .to(self.device)
            .eval()
        )
        self._fe_ctc = Wav2Vec2FeatureExtractor.from_pretrained(
            self.cache / "alignment", local_files_only=True
        )
        self._vocab = json.loads(
            (self.cache / "alignment/vocab.json").read_text(encoding="utf-8")
        )
        self._blank_idx = self._vocab.get("<pad>", 0)
        self._g2p = G2p()
        self._loaded = True

    @staticmethod
    def load_audio(path):
        with wave.open(str(path), "rb") as audio:
            if (audio.getframerate(), audio.getnchannels(), audio.getsampwidth()) != (
                16000,
                1,
                2,
            ):
                raise ValueError("Expected normalized WAV")
            pcm = audio.readframes(audio.getnframes())
        return torch.from_numpy(
            np.frombuffer(pcm, dtype="<i2").astype(np.float32).copy() / 32768.0
        ).unsqueeze(0)

    def _text_to_phonemes(self, text):
        words = re.sub(r"[^\w' ]", " ", text).split()
        result = []
        for word_idx, word in enumerate(words):
            phones_raw = self._g2p(word)
            for ph in phones_raw:
                if ph == " ":
                    continue
                clean = re.sub(r"\d", "", ph).lower()
                if clean:
                    result.append({"phone": clean, "word": word, "word_idx": word_idx})
        return result

    def _arpabet_to_model_idx(self, ph):
        for ipa in ARPABET_TO_IPA.get(ph, []):
            if ipa in self._vocab:
                return self._vocab[ipa]
        return self._vocab.get(ph, -1)

    @staticmethod
    def _viterbi_align(emissions, phone_indices, blank_idx):
        T, _C = emissions.shape
        S = len(phone_indices)
        if S == 0 or T < S:
            return []

        extended = [blank_idx]
        for p in phone_indices:
            extended.append(p)
            extended.append(blank_idx)
        S_ext = len(extended)

        NEG_INF = float("-inf")
        dp = np.full((T, S_ext), NEG_INF, dtype=np.float64)
        bp = np.zeros((T, S_ext), dtype=np.int32)
        dp[0][0] = emissions[0, extended[0]].item()
        if S_ext > 1:
            dp[0][1] = emissions[0, extended[1]].item()

        for t in range(1, T):
            for s in range(S_ext):
                emit = emissions[t, extended[s]].item()
                best, best_s = dp[t - 1][s], s
                if s > 0 and dp[t - 1][s - 1] > best:
                    best, best_s = dp[t - 1][s - 1], s - 1
                if (
                    s > 1
                    and extended[s] != blank_idx
                    and extended[s] != extended[s - 2]
                    and dp[t - 1][s - 2] > best
                ):
                    best, best_s = dp[t - 1][s - 2], s - 2
                dp[t][s] = best + emit
                bp[t][s] = best_s

        s = (
            S_ext - 1
            if (S_ext >= 2 and dp[T - 1][S_ext - 1] >= dp[T - 1][S_ext - 2])
            else max(S_ext - 2, 0)
        )
        if not np.isfinite(dp[T - 1][s]):
            raise ValueError("No finite alignment path")
        path = []
        for t in range(T - 1, -1, -1):
            path.append((t, extended[s]))
            s = bp[t][s]
        path.reverse()
        return path

    @torch.no_grad()
    def _score_phonemes(self, waveform, phone_indices):
        """
        Given waveform and expected phone indices, returns per-phoneme scores.
        Steps:
            1. CTC emissions → Viterbi alignment → frame segments
            2. WavLM backbone → hidden states per segment
            3. GOP from CTC emissions
            4. MLP head → score + pherr probability
        """
        wav_np = waveform.squeeze(0).numpy()

        # CTC emissions for alignment
        ctc_inputs = self._fe_ctc(
            wav_np, sampling_rate=SAMPLE_RATE, return_tensors="pt", padding=True
        )
        ctc_logits = self._ctc_model(ctc_inputs.input_values.to(self.device)).logits
        emissions = torch.log_softmax(ctc_logits, dim=-1).squeeze(0).cpu()

        # Viterbi alignment
        path = self._viterbi_align(emissions, phone_indices, self._blank_idx)
        if not path:
            return None

        # Group frames by phoneme
        segments = []
        cur_tok, cur_frames = None, []
        for f, tok in path:
            if tok == self._blank_idx:
                if cur_tok is not None:
                    segments.append((cur_tok, cur_frames))
                    cur_tok, cur_frames = None, []
                continue
            if tok != cur_tok:
                if cur_tok is not None:
                    segments.append((cur_tok, cur_frames))
                cur_tok, cur_frames = tok, [f]
            else:
                cur_frames.append(f)
        if cur_tok is not None:
            segments.append((cur_tok, cur_frames))

        if (
            len(segments) != len(phone_indices)
            or [s[0] for s in segments] != phone_indices
        ):
            raise ValueError("Incomplete forced alignment")

        # WavLM backbone hidden states
        bb_inputs = self._fe_backbone(
            wav_np, sampling_rate=SAMPLE_RATE, return_tensors="pt", padding=True
        )
        hidden = self._backbone(
            bb_inputs.input_values.to(self.device)
        ).last_hidden_state.squeeze(0)  # (T_h, 1024)
        T_h = hidden.shape[0]
        T_ctc = emissions.shape[0]
        scale = T_h / T_ctc

        # Per-phoneme: pool hidden states, compute GOP, run MLP
        results = []
        for i, expected_idx in enumerate(phone_indices):
            if i >= len(segments):
                raise ValueError("Missing alignment segment")

            _, frames = segments[i]

            # Pool hidden states
            h_start = max(0, int(min(frames) * scale))
            h_end = min(T_h, int((max(frames) + 1) * scale))
            if h_end <= h_start:
                raise ValueError("Empty backbone segment")
            h_pooled = hidden[h_start:h_end].mean(dim=0)  # (1024,)

            # GOP
            seg_em = emissions[frames]
            target_lp = seg_em[:, expected_idx].mean().item()
            mask = torch.ones(emissions.shape[1], dtype=torch.bool)
            mask[self._blank_idx] = False
            mask[expected_idx] = False
            best_other = seg_em[:, mask].max(dim=-1).values.mean().item()
            gop = target_lp - best_other

            results.append(
                {
                    "h": h_pooled,
                    "gop": gop,
                    "n_frames": len(frames),
                }
            )

        # Batch MLP inference
        valid_indices = [i for i, r in enumerate(results) if "h" in r]
        if valid_indices:
            h_batch = torch.stack([results[i]["h"] for i in valid_indices]).to(
                self.device
            )
            gop_batch = torch.tensor(
                [results[i]["gop"] for i in valid_indices], dtype=torch.float32
            ).to(self.device)
            nf_batch = torch.tensor(
                [results[i]["n_frames"] for i in valid_indices], dtype=torch.float32
            ).to(self.device)

            # Return raw data for batch processing in assess()
            return results, valid_indices, h_batch, gop_batch, nf_batch

        return results, [], None, None, None

    @torch.inference_mode()
    def assess(self, audio_path, text):
        """
        Assess pronunciation of an audio file against reference text.

        Returns dict with overall_score, words (with per-phoneme scores and errors).
        """
        self._load_models()

        # G2P
        phone_info = self._text_to_phonemes(text)
        if not phone_info:
            return {
                "text": text,
                "overall_score": 0,
                "words": [],
                "error": "No phonemes extracted",
            }

        # Map to model indices
        indices = []
        valid_info = []
        for pi in phone_info:
            idx = self._arpabet_to_model_idx(pi["phone"])
            if idx >= 0:
                indices.append(idx)
                valid_info.append(pi)
        if len(indices) != len(phone_info):
            raise ValueError("Unmapped reference phoneme")
        if not indices:
            return {
                "text": text,
                "overall_score": 0,
                "words": [],
                "error": "No phonemes mapped",
            }

        # Load audio & score
        waveform = self.load_audio(audio_path)
        result = self._score_phonemes(waveform, indices)
        if result is None:
            return {
                "text": text,
                "overall_score": 0,
                "words": [],
                "error": "Alignment failed",
            }

        raw_results, valid_idx, h_batch, gop_batch, nf_batch = result

        # Run MLP scoring
        if h_batch is not None:
            pid_list = [PHONE_TO_ID.get(valid_info[i]["phone"], 0) for i in valid_idx]
            pid_batch = torch.tensor(pid_list, dtype=torch.long).to(self.device)

            pred_score, pred_pherr_logit = self._scorer(
                h_batch, pid_batch, gop_batch, nf_batch
            )
            pred_score = pred_score.detach().cpu().numpy()
            pred_pherr = torch.sigmoid(pred_pherr_logit).detach().cpu().numpy()

            for j, i in enumerate(valid_idx):
                raw_results[i]["score"] = float(pred_score[j])
                raw_results[i]["pherr_prob"] = float(pred_pherr[j])

        # Assemble per-phoneme results
        phoneme_results = []
        for i, (info, raw) in enumerate(zip(valid_info, raw_results)):
            score = raw["score"]
            pherr_prob = raw["pherr_prob"]
            phoneme_results.append(
                {
                    "phone": info["phone"],
                    "word": info["word"],
                    "word_idx": info["word_idx"],
                    "score": round(score, 1),
                    "gop": round(raw["gop"], 3),
                    "pherr_prob": float(pherr_prob),
                    "error": pherr_prob >= self.pherr_threshold,
                }
            )

        # Group by word
        words_dict = {}
        for pr in phoneme_results:
            widx = pr["word_idx"]
            if widx not in words_dict:
                words_dict[widx] = {"word": pr["word"], "phonemes": []}
            words_dict[widx]["phonemes"].append(
                {
                    "phone": pr["phone"],
                    "score": pr["score"],
                    "gop": pr["gop"],
                    "pherr_prob": pr["pherr_prob"],
                    "error": pr["error"],
                }
            )

        # Word-level scores
        words_list = []
        for widx in sorted(words_dict.keys()):
            wd = words_dict[widx]
            scores = [p["score"] for p in wd["phonemes"]]
            n_errors = sum(1 for p in wd["phonemes"] if p["error"])
            mean_score = np.mean(scores)
            words_list.append(
                {
                    "word": wd["word"],
                    "score": round(float(mean_score), 1),
                    "n_errors": n_errors,
                    "n_phonemes": len(wd["phonemes"]),
                    "has_error": n_errors > 0,
                    "phonemes": wd["phonemes"],
                }
            )

        # Overall score
        all_scores = [pr["score"] for pr in phoneme_results]
        overall_score = np.mean(all_scores)
        n_total_errors = sum(1 for pr in phoneme_results if pr["error"])

        return {
            "text": text,
            "overall_score": round(float(overall_score), 1),
            "n_phonemes": len(phoneme_results),
            "n_errors": n_total_errors,
            "error_rate": round(n_total_errors / len(phoneme_results) * 100, 1),
            "words": words_list,
        }
