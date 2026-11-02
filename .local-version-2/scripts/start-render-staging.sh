#!/usr/bin/env bash
set -euo pipefail

cd services/api
if [[ "${FLUENTT_DATABASE_URL:-}" == postgresql://* ]]; then
  export FLUENTT_DATABASE_URL="postgresql+psycopg://${FLUENTT_DATABASE_URL#postgresql://}"
fi
python -m scripts.init_render_staging_db
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-10000}" --proxy-headers --forwarded-allow-ips='*' --no-access-log
