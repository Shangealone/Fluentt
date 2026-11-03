"""Bounded synthetic optimization only. Never creates a research-ready model."""
# ruff: noqa: E402
# Start timing before importing Torch so the report includes its startup cost.
import time
BOOT = time.perf_counter()

import ctypes
from ctypes import wintypes
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
from pathlib import Path
import platform
import random
import subprocess
import sys
import unittest

import torch

from smoke_model import Candidate, Encounter, CausalReviewModel, VERSION, encode_batch
from smoke_tests import SmokeContracts


def peak_working_set():
    """Windows peak resident working set, including native tensor allocations."""
    if sys.platform != "win32":
        return None
    class Counters(ctypes.Structure):
        _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD),
                    *[(key, ctypes.c_size_t) for key in (
                        "PeakWorkingSetSize", "WorkingSetSize", "QuotaPeakPagedPoolUsage", "QuotaPagedPoolUsage",
                        "QuotaPeakNonPagedPoolUsage", "QuotaNonPagedPoolUsage", "PagefileUsage", "PeakPagefileUsage")]]
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    psapi = ctypes.WinDLL("psapi", use_last_error=True)
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
    psapi.GetProcessMemoryInfo.restype = wintypes.BOOL
    counters = Counters()
    counters.cb = ctypes.sizeof(counters)
    if not psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
        return None
    return counters.PeakWorkingSetSize


def main():
    root = Path(__file__).resolve().parents[4]
    output = root/"private-data/esr-training/results"
    output.mkdir(parents=True, exist_ok=True)
    # Remove a stale success report before checks; failure must not appear successful.
    report_path = output/"cpu-smoke-report.json"
    report_path.unlink(missing_ok=True)
    torch.set_num_threads(2)
    torch.use_deterministic_algorithms(True)
    log = io.StringIO()
    tested = unittest.TextTestRunner(stream=log, verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(SmokeContracts))
    (output/"unit-tests.txt").write_text(log.getvalue(), encoding="utf-8")
    if not tested.wasSuccessful():
        print(log.getvalue())
        return 1
    if time.perf_counter()-BOOT > 180:
        raise RuntimeError("Smoke setup exceeded the bounded time budget.")
    random.seed(12026)
    torch.manual_seed(12026)
    now = datetime(2026, 11, 2, tzinfo=timezone.utc)
    histories, candidates = [], []
    for learner in range(8):
        histories.append([Encounter(item=1+(step+learner)%15,
                          format="multiple_choice" if step%2 else "typed_recall",
                          correct=bool((step+learner)%3), at=now-timedelta(days=12-step)) for step in range(12)])
        candidates.append(Candidate(item=1+learner, format="typed_recall" if learner%2 else "multiple_choice", horizon_days=3))
    batch = encode_batch(histories, candidates, now)
    labels = torch.tensor([float(learner%2) for learner in range(8)])
    architecture = dict(vocabulary_size=16, embedding_dim=8, hidden_dim=12)
    model = CausalReviewModel(**architecture)
    optimizer = torch.optim.Adam(model.parameters(), lr=.01)
    before = [value.detach().clone() for value in model.parameters()]
    losses, gradient_norms = [], []
    start = time.perf_counter()
    for _ in range(12):
        if time.perf_counter()-start > 30:
            raise RuntimeError("Synthetic optimization exceeded 30 seconds.")
        optimizer.zero_grad(set_to_none=True)
        logits = model(**batch)
        loss = torch.nn.functional.binary_cross_entropy_with_logits(logits, labels)
        if not torch.isfinite(loss):
            raise RuntimeError("Non-finite loss; stop.")
        loss.backward()
        gradients = [p.grad for p in model.parameters() if p.grad is not None]
        if not gradients or any(not torch.isfinite(value).all() for value in gradients):
            raise RuntimeError("Invalid gradients; stop.")
        norm = sum(float(value.square().sum()) for value in gradients)**.5
        if norm <= 0:
            raise RuntimeError("No real gradient update.")
        gradient_norms.append(norm)
        optimizer.step()
        if any(not torch.isfinite(value).all() for value in model.parameters()):
            raise RuntimeError("Invalid updated weights; stop.")
        losses.append(float(loss.detach()))
    if not any(not torch.equal(old, new) for old, new in zip(before, model.parameters())):
        raise RuntimeError("No parameters changed.")
    optimization_seconds = time.perf_counter()-start
    model.eval()
    with torch.no_grad():
        expected = model(**batch)
    checkpoint = output/"synthetic-smoke-only.pt"
    torch.save(model.state_dict(), checkpoint)
    restored = CausalReviewModel(**architecture).eval()
    restored.load_state_dict(torch.load(checkpoint, weights_only=True, map_location="cpu"))
    with torch.no_grad():
        torch.testing.assert_close(expected, restored(**batch), rtol=0, atol=0)
    lock = subprocess.run([sys.executable, "-m", "pip", "freeze", "--all"], check=True, capture_output=True, text=True)
    (output/"installed-versions.txt").write_text(lock.stdout, encoding="utf-8")
    source_hashes = {name: hashlib.sha256((Path(__file__).parent/name).read_bytes()).hexdigest()
                     for name in ("smoke_model.py", "smoke_tests.py", "run_cpu_smoke.py", "SMOKE_ADAPTATIONS.md")}
    report = dict(schema="fluentt-cpu-engineering-smoke-v1", model_version=VERSION,
                  recorded_at_utc=datetime.now(timezone.utc).isoformat(), synthetic_only=True,
                  research_ready=False, faithful_paper_reproduction=False, real_data_training=False,
                  torch_version=torch.__version__, python_version=platform.python_version(),
                  device="cpu", cuda_runtime=torch.version.cuda, cpu_threads=torch.get_num_threads(), seed=12026,
                  architecture=architecture, batch_size=8, history_steps=12, optimization_steps=12,
                  tests_run=tested.testsRun, failures=len(tested.failures), errors=len(tested.errors),
                  losses=losses, gradient_norms=gradient_norms, optimization_seconds=optimization_seconds,
                  total_elapsed_seconds=time.perf_counter()-BOOT, peak_working_set_bytes=peak_working_set(),
                  weights_only_round_trip_equal=True, checkpoint_sha256=hashlib.sha256(checkpoint.read_bytes()).hexdigest(),
                  source_sha256=source_hashes)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("tests_run", "optimization_steps", "optimization_seconds", "total_elapsed_seconds", "peak_working_set_bytes", "research_ready")}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
