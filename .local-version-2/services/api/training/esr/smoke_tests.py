"""Synthetic engineering tests. No learner data or real model accuracy assertions."""
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import math
from pathlib import Path
import tempfile
import unittest

import torch

from smoke_model import Candidate, Encounter, CausalReviewModel, encode_batch

NOW = datetime(2026, 11, 2, tzinfo=timezone.utc)


def fixture():
    histories = [[Encounter(item=1, format="typed_recall", correct=True, at=NOW-timedelta(days=3)),
                  Encounter(item=2, format="multiple_choice", correct=False, at=NOW-timedelta(days=1))],
                 [Encounter(item=3, format="multiple_choice", correct=True, at=NOW-timedelta(days=2))]]
    candidates = [Candidate(item=1, format="multiple_choice", horizon_days=3),
                  Candidate(item=4, format="typed_recall", horizon_days=5)]
    return histories, candidates


class SmokeContracts(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(2)
        torch.manual_seed(12026)
        self.model = CausalReviewModel(vocabulary_size=16, embedding_dim=8, hidden_dim=12).eval()

    def test_zero_counts_and_new_history_are_finite(self):
        _, candidates = fixture()
        batch = encode_batch([[], []], candidates, NOW)
        logits = self.model(**batch)
        self.assertTrue(torch.isfinite(logits).all())
        self.assertEqual(tuple(logits.shape), (2,))

    def test_other_learners_and_batch_order_cannot_change_prediction(self):
        histories, candidates = fixture()
        first = self.model(**encode_batch(histories, candidates, NOW)).detach()
        histories[1] = [replace(histories[1][0], correct=False, item=6)]
        changed = self.model(**encode_batch(histories, candidates, NOW)).detach()
        torch.testing.assert_close(first[0], changed[0], rtol=0, atol=1e-7)
        permuted = self.model(**encode_batch(histories[::-1], candidates[::-1], NOW)).detach()
        torch.testing.assert_close(changed, permuted.flip(0), rtol=0, atol=1e-7)
        alone = self.model(**encode_batch([histories[0]], [candidates[0]], NOW)).detach()
        torch.testing.assert_close(changed[0], alone[0], rtol=0, atol=1e-7)

    def test_current_and_future_answers_are_excluded(self):
        histories, candidates = fixture()
        first = self.model(**encode_batch(histories, candidates, NOW)).detach()
        histories[0] += [Encounter(item=1, format="multiple_choice", correct=False, at=NOW),
                         Encounter(item=1, format="multiple_choice", correct=True, at=NOW+timedelta(days=1))]
        changed = self.model(**encode_batch(histories, candidates, NOW)).detach()
        torch.testing.assert_close(first, changed, rtol=0, atol=0)

    def test_padding_does_not_change_prediction(self):
        histories, candidates = fixture()
        batch = encode_batch(histories, candidates, NOW)
        original = self.model(**batch).detach()
        batch["history_items"][1, 1:] = 8
        batch["history_features"][1, 1:] = 2
        batch["history_correct"][1, 1:] = 1
        batch["history_formats"][1, 1:] = 2
        changed = self.model(**batch).detach()
        torch.testing.assert_close(original, changed, rtol=0, atol=0)

    def test_invalid_history_and_candidate_inputs_are_rejected(self):
        histories, candidates = fixture()
        for invalid in [replace(candidates[0], horizon_days=float("nan")),
                        replace(candidates[0], horizon_days=-1), replace(candidates[0], format="invented"),
                        replace(candidates[0], item=0)]:
            with self.assertRaises(ValueError):
                encode_batch(histories, [invalid, candidates[1]], NOW)
        with self.assertRaises(ValueError):
            encode_batch([histories[0][::-1], histories[1]], candidates, NOW)
        with self.assertRaises(ValueError):
            encode_batch(histories, candidates, NOW.replace(tzinfo=None))

    def test_loss_and_gradient_update_are_finite_and_real(self):
        histories, candidates = fixture()
        batch = encode_batch(histories, candidates, NOW)
        optimizer = torch.optim.Adam(self.model.parameters(), lr=.01)
        before = [p.detach().clone() for p in self.model.parameters()]
        logits = self.model(**batch)
        labels = torch.tensor([1., 0.])  # labels enter loss only, never the model inputs
        loss = torch.nn.functional.binary_cross_entropy_with_logits(logits, labels)
        loss.backward()
        gradients = [p.grad for p in self.model.parameters() if p.grad is not None]
        self.assertTrue(gradients and all(torch.isfinite(g).all() for g in gradients))
        self.assertGreater(sum(float(g.abs().sum()) for g in gradients), 0)
        optimizer.step()
        self.assertTrue(any(not torch.equal(old, new) for old, new in zip(before, self.model.parameters())))
        self.assertTrue(math.isfinite(float(loss.detach())))
        for swapped_labels in (1-labels, labels):
            torch.nn.functional.binary_cross_entropy_with_logits(self.model(**batch), swapped_labels)
        torch.testing.assert_close(self.model(**batch), self.model(**batch), rtol=0, atol=0)

    def test_weights_only_round_trip_preserves_predictions(self):
        histories, candidates = fixture()
        batch = encode_batch(histories, candidates, NOW)
        expected = self.model(**batch).detach()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"synthetic-only.pt"
            torch.save(self.model.state_dict(), path)
            restored = CausalReviewModel(vocabulary_size=16, embedding_dim=8, hidden_dim=12).eval()
            restored.load_state_dict(torch.load(path, weights_only=True, map_location="cpu"))
            torch.testing.assert_close(expected, restored(**batch), rtol=0, atol=0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
