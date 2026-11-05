"""Engineering tests; synthetic fixtures do not establish model accuracy."""
import copy
import hashlib
import math
import subprocess
import sys
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

import torch
import psutil
from development_data import examples_for, split_for
from development_metrics import metrics, paired_cluster_interval
from development_worker import calibrate
import run_development_validation as launcher


class DevelopmentContracts(unittest.TestCase):
    def test_historical_reserved_test_and_validation_buckets_are_preserved(self):
        for index in range(1000):
            user = f"synthetic-{index}"
            bucket = int(hashlib.sha256(("fluentt-public-pilot-v1:"+user).encode()).hexdigest()[:8], 16) % 10
            expected = "train" if bucket < 7 else "calibration" if bucket == 7 else "validation" if bucket == 8 else "test"
            self.assertEqual(split_for(user), expected)

    def test_history_excludes_equal_or_later_timestamp(self):
        rows = [dict(at=at, order=i, delta=0, correct=0, seen=0, target=.5, word="one", item="one")
                for i, at in enumerate((30., 10., 20., 20.))]
        for history, candidate in examples_for(rows):
            self.assertTrue(all(row["at"] < candidate["at"] for row in history))
            self.assertTrue(all(math.isfinite(value) for value in candidate["features"]))

    def test_current_target_cannot_change_current_features(self):
        rows = [dict(at=float(i), order=i, delta=0, correct=0, seen=0, target=.5, word="one", item="one") for i in range(3)]
        before = examples_for(rows)[-1]
        changed = copy.deepcopy(rows)
        changed[-1]["target"] = 0
        after = examples_for(changed)[-1]
        self.assertEqual(before[1]["features"], after[1]["features"])
        self.assertEqual([row["target"] for row in before[0]], [row["target"] for row in after[0]])

    def test_bounded_history_and_examples(self):
        rows = [dict(at=float(i), order=i, delta=0, correct=0, seen=0, target=.5, word="one", item="one") for i in range(100)]
        examples = examples_for(rows)
        self.assertEqual(len(examples), 8)
        self.assertLessEqual(max(len(history) for history, _ in examples), 24)

    def test_metrics_have_known_values_and_do_not_report_accuracy(self):
        result = metrics([.25, .75], [0., 1.])
        self.assertAlmostEqual(result["mae"], .25)
        self.assertAlmostEqual(result["rmse"], .25)
        self.assertAlmostEqual(result["soft_target_bce"], -math.log(.75))
        self.assertNotIn("accuracy", result)

    def test_invalid_predictions_are_rejected(self):
        for values in ([], [float("nan")], [float("inf")], [-.1], [1.1]):
            with self.assertRaises(ValueError):
                metrics(values, [.5])

    def test_cluster_bootstrap_is_paired_and_reproducible(self):
        rows = [dict(cluster=str(i), target=.5, model=.5, constant=0.) for i in range(5)]
        first = paired_cluster_interval(rows, "model", "constant")
        self.assertEqual(first, paired_cluster_interval(rows, "model", "constant"))
        self.assertEqual(first["percentile_95"], [-.5, -.5])

    def test_calibration_finite_and_selected_only_if_bce_improves(self):
        result = calibrate(torch.tensor([-3., 0., 3.]), [.2, .5, .8])
        self.assertGreater(result["temperature"], 0)
        self.assertTrue(all(math.isfinite(value) for value in result.values()))
        self.assertLessEqual(result["selected_bce"], result["identity_bce"])

    def test_launcher_blocks_insufficient_ram_before_creating_output(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "result"
            with patch("sys.argv", ["launcher", "--output", str(output)]), \
                    patch.object(launcher.psutil, "virtual_memory") as memory:
                memory.return_value.available = 3 * 1024**3
                self.assertEqual(launcher.main(), 2)
                self.assertFalse(output.exists())

    def test_launcher_refuses_to_overwrite_old_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch("sys.argv", ["launcher", "--output", folder]), \
                    patch.object(launcher.psutil, "virtual_memory") as memory:
                memory.return_value.available = 5 * 1024**3
                with self.assertRaises(FileExistsError):
                    launcher.main()

    def test_owned_child_processes_are_measured_and_stopped(self):
        code = "import subprocess,sys,time; p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(20)']); print(p.pid,flush=True); time.sleep(20)"
        process = subprocess.Popen([sys.executable, "-c", code], stdout=subprocess.PIPE, text=True)
        observed = []
        try:
            child_pid = int(process.stdout.readline().strip())
            observed = launcher.owned_processes(psutil.Process(process.pid))
            self.assertIn(child_pid, [row.pid for row in observed])
            self.assertGreater(launcher.owned_rss(observed), 0)
            launcher.stop_owned(observed)
            process.wait(timeout=5)
            self.assertTrue(all(not row.is_running() for row in observed))
        finally:
            launcher.stop_owned(observed)
            if process.poll() is None:
                process.kill()
            process.wait(timeout=5)
            process.stdout.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
