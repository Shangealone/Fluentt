"""Hard-deadline launcher for an isolated, real-data CPU engineering pilot."""

import os
from pathlib import Path
import subprocess
import sys


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[4]
    folder = root / "private-data/esr-training/public-pilot"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "report.json").unlink(missing_ok=True)
    env = os.environ.copy()
    env.update(
        TEMP=str(root / "private-data/esr-training/tmp"),
        TMP=str(root / "private-data/esr-training/tmp"),
        OMP_NUM_THREADS="2",
        MKL_NUM_THREADS="2",
        PYTHONUNBUFFERED="1",
    )
    with (folder / "run.log").open("w", encoding="utf-8") as log:
        try:
            result = subprocess.run(
                [sys.executable, str(Path(__file__).with_name("public_pilot_worker.py"))],
                env=env,
                stdout=log,
                stderr=subprocess.STDOUT,
                timeout=300,
            )
        except subprocess.TimeoutExpired:
            print("Pilot stopped at the five-minute hard deadline; inspect the local log.")
            raise SystemExit(1)
    print((folder / "run.log").read_text(encoding="utf-8"))
    raise SystemExit(result.returncode)
