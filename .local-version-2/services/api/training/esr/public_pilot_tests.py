"""Synthetic engineering contracts for the public-data pilot, not accuracy evidence."""

import copy
import unittest
import torch
from public_pilot_model import PublicPilotModel
from public_pilot_worker import batch


class PilotContracts(unittest.TestCase):
    def setUp(self):
        torch.set_num_threads(2)
        torch.manual_seed(20261104)
        self.model = PublicPilotModel(6, 6).eval()
        self.mapping = {"one": 2, "two": 3, "three": 4}
        self.mean, self.scale = torch.zeros(6), torch.ones(6)
        self.examples = []
        for index in range(3):
            event = {"at": 10.0, "target": 0.5, "word": "one", "item": "one", "features": [0.0] * 6}
            candidate = {"at": 20.0, "target": 0.8, "word": "two", "item": "two", "features": [1.0] * 6}
            self.examples.append(([copy.deepcopy(event) for _ in range(index + 1)], copy.deepcopy(candidate)))

    def encode(self, examples=None):
        return batch(examples or self.examples, self.mapping, self.mapping, self.mean, self.scale)

    def test_batch_permutation_and_other_learner_independence(self):
        x, _ = self.encode()
        with torch.no_grad():
            original = self.model(**x)
            permuted = self.model(**{key: value.flip(0) for key, value in x.items()}).flip(0)
            self.assertTrue(torch.allclose(original, permuted, atol=1e-6))
            x["responses"][1] = 0.0
            x["hwords"][1] = 4
            altered = self.model(**x)
            self.assertTrue(torch.allclose(original[[0, 2]], altered[[0, 2]], atol=1e-6))

    def test_target_response_is_not_model_input(self):
        first, labels = self.encode()
        changed = copy.deepcopy(self.examples)
        changed[0][1]["target"] = 0.1
        second, other_labels = self.encode(changed)
        self.assertFalse(torch.equal(labels, other_labels))
        self.assertTrue(all(torch.equal(first[key], second[key]) for key in first))

    def test_current_and_future_history_rejected(self):
        for at in (20.0, 21.0):
            changed = copy.deepcopy(self.examples)
            changed[0][0][0]["at"] = at
            with self.assertRaisesRegex(RuntimeError, "Current/future"):
                self.encode(changed)

    def test_padding_does_not_change_predictions(self):
        x, _ = self.encode()
        with torch.no_grad():
            original = self.model(**x)
            for key in ("hwords", "hitems", "features", "responses"):
                value = x[key]
                x[key] = torch.cat([value, torch.zeros((value.shape[0], 3, *value.shape[2:]), dtype=value.dtype)], 1)
            self.assertTrue(torch.allclose(original, self.model(**x), atol=1e-6))

    def test_finite_nonzero_gradient_and_update(self):
        x, labels = self.encode()
        before = self.model.head[-1].weight.detach().clone()
        optimizer = torch.optim.Adam(self.model.parameters(), lr=0.001)
        loss = torch.nn.functional.binary_cross_entropy_with_logits(self.model(**x), labels)
        loss.backward()
        gradients = [p.grad for p in self.model.parameters() if p.grad is not None]
        self.assertTrue(all(torch.isfinite(g).all() for g in gradients))
        self.assertGreater(sum(float(g.abs().sum()) for g in gradients), 0)
        optimizer.step()
        self.assertFalse(torch.equal(before, self.model.head[-1].weight))


if __name__ == "__main__":
    unittest.main(verbosity=2)
