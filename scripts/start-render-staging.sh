#!/usr/bin/env bash
set -euo pipefail

cd services/api
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-10000}" --proxy-headers --forwarded-allow-ips='*' --no-access-log
