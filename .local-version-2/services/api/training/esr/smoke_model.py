"""Synthetic-only causal engineering adaptation; not a production FIFAKT provider."""
from dataclasses import dataclass
from datetime import datetime
import math

import torch
from torch import nn
from torch.nn.utils.rnn import pack_padded_sequence, pad_packed_sequence

FORMATS = {"multiple_choice": 1, "typed_recall": 2}
VERSION = "esr-causal-cpu-engineering-v1"


@dataclass(frozen=True)
class Encounter:
    item: int
    format: str
    correct: bool
    at: datetime


@dataclass(frozen=True)
class Candidate:
    item: int
    format: str
    horizon_days: float


def aware(value):
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Timezone-aware observation times are required.")


def item_format(row, vocabulary_size):
    if type(row.item) is not int or not 1 <= row.item < vocabulary_size or row.format not in FORMATS:
        raise ValueError("Choose a valid item and explicit question format.")


def features(prior, item, at):
    same = [row for row in prior if row.item == item]
    gap = (at-prior[-1].at).total_seconds()/86400 if prior else 0.
    item_gap = (at-same[-1].at).total_seconds()/86400 if same else 0.
    raw = [len(prior), sum(row.correct for row in prior), gap, item_gap,
           len(same), sum(row.correct for row in same)]
    if any(not math.isfinite(value) or value < 0 for value in raw):
        raise ValueError("Invalid causal count or elapsed time.")
    return [math.log1p(value) for value in raw]


def encode_batch(histories, candidates, as_of, vocabulary_size=16, max_history=32):
    """Validate strict past-only histories; losses/held-out labels are not accepted."""
    from datetime import timedelta
    aware(as_of)
    if not 1 <= len(histories) == len(candidates) <= 32 or not 1 <= max_history <= 64:
        raise ValueError("A bounded, aligned batch is required.")
    retained, candidate_features = [], []
    for history, candidate in zip(histories, candidates):
        item_format(candidate, vocabulary_size)
        horizon = candidate.horizon_days
        if isinstance(horizon, bool) or not isinstance(horizon, (int, float)) or not math.isfinite(horizon) or not 0 < horizon <= 36500:
            raise ValueError("A positive finite bounded horizon is required.")
        if len(history) > 64:
            raise ValueError("This smoke harness accepts at most 64 supplied encounters per learner.")
        for row in history:
            aware(row.at)
        past = [row for row in history if row.at < as_of]
        if len(past) > max_history:
            raise ValueError("Choose an explicit bounded history window before encoding.")
        for index, row in enumerate(past):
            item_format(row, vocabulary_size)
            if type(row.correct) is not bool or (index and row.at < past[index-1].at):
                raise ValueError("Retained encounters need objective booleans in chronological order.")
        retained.append(past)
        try:
            candidate_features.append(features(past, candidate.item, as_of+timedelta(days=horizon)))
        except OverflowError as error:
            raise ValueError("Prediction time exceeds the supported date range.") from error
    batch_size, timesteps = len(retained), max(1, max(map(len, retained)))
    result = {
        "history_items": torch.zeros(batch_size, timesteps, dtype=torch.long),
        "history_formats": torch.zeros(batch_size, timesteps, dtype=torch.long),
        "history_features": torch.zeros(batch_size, timesteps, 6),
        "history_correct": torch.zeros(batch_size, timesteps),
        "lengths": torch.tensor(list(map(len, retained)), dtype=torch.long),
        "candidate_items": torch.tensor([row.item for row in candidates], dtype=torch.long),
        "candidate_formats": torch.tensor([FORMATS[row.format] for row in candidates], dtype=torch.long),
        "candidate_features": torch.tensor(candidate_features, dtype=torch.float32),
    }
    for i, past in enumerate(retained):
        for j, row in enumerate(past):
            result["history_items"][i, j] = row.item
            result["history_formats"][i, j] = FORMATS[row.format]
            result["history_features"][i, j] = torch.tensor(features(past[:j], row.item, row.at))
            result["history_correct"][i, j] = float(row.correct)
    return result


class CausalReviewModel(nn.Module):
    """One next-encounter logit per independent learner; labels are external."""
    def __init__(self, vocabulary_size=16, embedding_dim=8, hidden_dim=12):
        super().__init__()
        if not 2 <= vocabulary_size <= 10000 or not 1 <= embedding_dim <= 64 or not 1 <= hidden_dim <= 128:
            raise ValueError("Use a bounded smoke-test architecture.")
        self.items = nn.Embedding(vocabulary_size, embedding_dim, padding_idx=0)
        self.rnn = nn.LSTM(embedding_dim+3+6+1, hidden_dim, batch_first=True)
        self.keys = nn.Linear(embedding_dim+3, hidden_dim, bias=False)
        self.query = nn.Linear(embedding_dim+3, hidden_dim, bias=False)
        self.head = nn.Sequential(nn.Linear(hidden_dim*2+embedding_dim+3+6, 16), nn.ReLU(), nn.Linear(16, 1))

    def forward(self, history_items, history_formats, history_features, history_correct, lengths,
                candidate_items, candidate_formats, candidate_features):
        tensors = [history_items, history_formats, history_features, history_correct, lengths,
                   candidate_items, candidate_formats, candidate_features]
        if any(value.device.type != "cpu" for value in tensors):
            raise ValueError("This bounded engineering harness is CPU-only.")
        if history_items.ndim != 2:
            raise ValueError("Expected batch-first item sequences.")
        b, t = history_items.shape
        if (not 1 <= b <= 32 or not 1 <= t <= 64 or history_formats.shape != (b, t)
                or history_features.shape != (b, t, 6) or history_correct.shape != (b, t)
                or lengths.shape != (b,) or candidate_items.shape != (b,)
                or candidate_formats.shape != (b,) or candidate_features.shape != (b, 6)
                or lengths.dtype != torch.long or (lengths < 0).any() or (lengths > t).any()):
            raise ValueError("Invalid bounded batch dimensions or lengths.")
        if any(not torch.isfinite(value).all() for value in tensors):
            raise ValueError("Non-finite model input.")
        observed = torch.cat([self.items(history_items), nn.functional.one_hot(history_formats, 3).float()], -1)
        candidate = torch.cat([self.items(candidate_items), nn.functional.one_hot(candidate_formats, 3).float()], -1)
        inputs = torch.cat([observed, history_features, history_correct.unsqueeze(-1)], -1)
        packed = pack_padded_sequence(inputs, lengths.clamp(min=1), batch_first=True, enforce_sorted=False)
        encoded, (last, _) = self.rnn(packed)
        output, _ = pad_packed_sequence(encoded, batch_first=True, total_length=t)
        mask = torch.arange(t).unsqueeze(0) < lengths.unsqueeze(1)
        scores = torch.bmm(self.keys(observed), self.query(candidate).unsqueeze(-1)).squeeze(-1)
        scores = scores/math.sqrt(output.shape[-1])
        weights = torch.softmax(scores.masked_fill(~mask, -1e9), -1)*mask
        context = torch.bmm(weights.unsqueeze(1), output).squeeze(1)
        final = last[0]*(lengths > 0).unsqueeze(-1)
        logits = self.head(torch.cat([context, final, candidate, candidate_features], -1)).squeeze(-1)
        if not torch.isfinite(logits).all():
            raise ValueError("Non-finite prediction; stop the smoke test.")
        return logits
