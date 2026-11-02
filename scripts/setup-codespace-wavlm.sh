#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
python3.12 -m venv private-data/codespace-api-venv
private-data/codespace-api-venv/bin/python -m pip install --requirement services/api/requirements.lock.txt

python3.12 -m venv private-data/codespace-wavlm-venv
model_python=private-data/codespace-wavlm-venv/bin/python
# Keep the reviewed 2.11 CPU build; the default PyPI Linux wheel can pull CUDA packages.
"$model_python" -m pip install torch==2.11.0 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cpu
"$model_python" -m pip install --requirement services/api/ml/wavlm/requirements.in
"$model_python" -m pip check
"$model_python" -c 'import torch, torchaudio; assert torch.__version__.startswith("2.11.0+cpu") and torchaudio.__version__.startswith("2.11.0+cpu"), "CPU-only pins changed"; print("Pinned CPU runtime imported; no model inference yet.")'

cd apps/mobile
npm ci
EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL= npx expo export --platform web
