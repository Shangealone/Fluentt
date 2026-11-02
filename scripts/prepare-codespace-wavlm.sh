#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
model_python=private-data/codespace-wavlm-venv/bin/python
cache="$(pwd)/private-data/wavlm-cache"
"$model_python" -c 'import psutil, shutil, sys; free=psutil.virtual_memory().available; disk=shutil.disk_usage("private-data").free; print(f"Available RAM: {free / 1024**3:.2f} GiB; free disk: {disk / 1024**3:.2f} GiB"); sys.exit(0 if free >= 5*1024**3 and disk >= 8*1024**3 else 2)'
"$model_python" services/api/ml/wavlm/prepare.py --cache "$cache"
PYTHONPATH=services/api private-data/codespace-api-venv/bin/python -c 'import sys; from app.modules.pronunciation.wavlm_runtime import verify_artifacts; verify_artifacts(sys.argv[1]); print("Pinned artifact manifest and hashes verified; no model inference yet.")' "$cache"
