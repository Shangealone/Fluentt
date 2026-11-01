"""GPL-3.0. Serial, bounded diagnostic worker supervisor; no production writes."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import time

import psutil


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["allosaurus", "mms"])
    parser.add_argument("--pilot", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    if list(args.output.iterdir()):
        raise ValueError("Use a fresh output directory; prior raw evidence must not be overwritten")
    api = Path(__file__).resolve().parents[2]
    for process in psutil.process_iter(["cmdline"]):
        command = process.info["cmdline"] or []
        if any(str(x).replace("\\", "/").endswith(("ml/mms/worker.py", "ml/wavlm/worker.py", "/run_pilot.py",
                                                  "allosaurus_stage2/benchmark.py"))
               for x in command):
            raise RuntimeError("Another speech worker is active")
    available = psutil.virtual_memory().available
    gate = (8 if args.mode == "mms" else 4) * 1024**3
    if available < gate:
        result = {"mode": args.mode, "status": "blocked_preflight", "start_available": available,
                  "required_available": gate, "worker_started": False}
        (args.output / "resources.json").write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
        return 2
    python = args.pilot / ".venv/Scripts/python.exe"
    command = [str(python), "-X", "utf8", str(Path(__file__).with_name("benchmark.py")),
               "--pilot", str(args.pilot.resolve()), "--output", str(args.output.resolve())]
    if args.mode == "mms":
        python = api / "ml/wavlm/.venv/Scripts/python.exe"
        command = [str(python), "-X", "utf8", str(args.pilot / "run_pilot.py"), "mms"]
    env = dict(os.environ, TORCH_FORCE_WEIGHTS_ONLY_LOAD="1", HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1",
               OMP_NUM_THREADS="2", MKL_NUM_THREADS="2", PYTHONDONTWRITEBYTECODE="1", PYTHONUTF8="1")
    start = time.perf_counter()
    peak = 0
    minimum = available
    cpu = {}
    stop = None
    with (args.output / "stdout.txt").open("w", encoding="utf-8") as out, (
            args.output / "stderr.txt").open("w", encoding="utf-8") as err:
        child = subprocess.Popen(command, stdout=out, stderr=err, env=env,
                                 creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        parent = psutil.Process(child.pid)
        while child.poll() is None:
            processes = []
            rss = 0
            try:
                processes = [parent] + parent.children(recursive=True)
                for process in processes:
                    try:
                        rss += process.memory_info().rss
                        times = process.cpu_times()
                        cpu[process.pid] = times.user + times.system
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
            except psutil.NoSuchProcess:
                pass
            peak = max(peak, rss)
            minimum = min(minimum, psutil.virtual_memory().available)
            if minimum < 1.5 * 1024**3:
                stop = "system_memory_floor"
            if rss > (6 if args.mode == "mms" else 3) * 1024**3:
                stop = "RSS_ceiling"
            if time.perf_counter() - start > 180:
                stop = "timeout"
            if stop:
                for process in reversed(processes):
                    try:
                        process.kill()
                    except psutil.NoSuchProcess:
                        pass
                break
            time.sleep(.1)
        code = child.wait(timeout=10)
    elapsed = time.perf_counter() - start
    result = {"mode": args.mode, "status": "pass" if code == 0 and not stop else "failed",
              "worker_exit": code, "stop_reason": stop, "wall_s": round(elapsed, 3),
              "peak_tree_RSS": peak, "start_available": available, "minimum_available": minimum,
              "after_available": psutil.virtual_memory().available, "cpu_seconds": round(sum(cpu.values()), 3),
              "average_one_core_percent": round(100 * sum(cpu.values()) / elapsed, 2), "sample_interval_ms": 100}
    (args.output / "resources.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result))
    return 0 if result["status"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
