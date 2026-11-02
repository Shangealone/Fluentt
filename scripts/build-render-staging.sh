#!/usr/bin/env bash
set -euo pipefail

python -m pip install --requirement services/api/requirements.lock.txt
cd apps/mobile
npm ci
EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL= npx expo export --platform web
