"""Resource-gated isolated process, bounded lifetime and immutable output directory."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import time

import psutil


def owned_processes(process):
    """Windows venv python.exe may be a redirector with the real worker as a child."""
    try:
        return [process, *process.children(recursive=True)]
    except psutil.NoSuchProcess:
        return []


def owned_rss(processes):
    total = 0
    for process in processes:
        try:
            total += process.memory_info().rss
        except psutil.NoSuchProcess:
            pass
    return total


def stop_owned(processes):
    # Only this launcher's snapshotted descendants and worker, never user apps.
    for process in reversed(processes):
        try:
            process.kill()
        except psutil.NoSuchProcess:
            pass
    psutil.wait_procs(processes, timeout=5)


def main():
    parser = argparse.ArgumentParser()
    root = Path(__file__).resolve().parents[4]
    parser.add_argument("--data", type=Path, default=root / "private-data/esr-training/public-data")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    available = psutil.virtual_memory().available
    if available < 4 * 1024**3:
        print(json.dumps(dict(status="BLOCKED", reason="insufficient_available_memory", available_bytes=available)))
        return 2
    args.output.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    peak = 0
    with (args.output / "run.log").open("w", encoding="utf-8") as log:
        process = subprocess.Popen([sys.executable, str(Path(__file__).with_name("development_worker.py")),
                                    "--data", str(args.data.resolve()), "--output", str(args.output.resolve())],
                                   stdout=log, stderr=subprocess.STDOUT)
        watched = psutil.Process(process.pid)
        reason = None
        while process.poll() is None:
            owned = owned_processes(watched)
            peak = max(peak, owned_rss(owned))
            if peak > 3 * 1024**3 or time.perf_counter()-started > 900:
                reason = "process_memory_or_deadline_limit"
                stop_owned(owned)
                break
            time.sleep(.5)
        code = process.wait()
    result = dict(exit_code=code, available_bytes_before=available, sampled_peak_bytes=peak,
                  elapsed_seconds=time.perf_counter()-started, stop_reason=reason)
    (args.output / "supervisor.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))
    if code == 0 and not reason:
        print((args.output / "report.json").read_text(encoding="utf-8"))
    else:
        print("Development run failed; inspect its ignored run.log. No model readiness is claimed.")
    return code if code else 1 if reason else 0


if __name__ == "__main__":
    raise SystemExit(main())
