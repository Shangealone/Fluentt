#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
: "${CODESPACE_NAME:?Run only inside the selected GitHub Codespace}"
: "${FLUENTT_DATABASE_URL:?Set the synthetic staging database URL as a Codespaces secret}"

export FLUENTT_ENVIRONMENT=production
export FLUENTT_SERVE_WEB=true
export FLUENTT_CORS_ORIGINS='[]'
export FLUENTT_MOBILE_WEB_ORIGINS="[\"https://${CODESPACE_NAME}-8000.app.github.dev\"]"
export FLUENTT_DATABASE_POOL_SIZE=2
export FLUENTT_DATABASE_MAX_OVERFLOW=0
export FLUENTT_PRONUNCIATION_MMS_ENABLED=false
export GROQ_TUTOR_ENABLED=false
export GROQ_TUTOR_SYNTHETIC_STAGING=false
export FLUENTT_PRONUNCIATION_WAVLM_DEVICE=cpu
export FLUENTT_PRONUNCIATION_WAVLM_PYTHON="$(pwd)/private-data/codespace-wavlm-venv/bin/python"
export FLUENTT_PRONUNCIATION_WAVLM_CACHE="$(pwd)/private-data/wavlm-cache"
export FLUENTT_PRONUNCIATION_WAVLM_ENABLED="${FLUENTT_PRONUNCIATION_WAVLM_ENABLED:-false}"

if [[ "$FLUENTT_DATABASE_URL" == postgresql://* ]]; then
  export FLUENTT_DATABASE_URL="postgresql+psycopg://${FLUENTT_DATABASE_URL#postgresql://}"
fi
if [[ -z "${FLUENTT_MOBILE_WEB_CSRF_SECRET:-}" ]]; then
  secret_file=private-data/codespace-csrf-secret
  if [[ ! -f "$secret_file" ]]; then
    umask 077
    private-data/codespace-api-venv/bin/python -c 'import pathlib, secrets; pathlib.Path("private-data/codespace-csrf-secret").write_text(secrets.token_urlsafe(48), encoding="utf-8")'
  fi
  export FLUENTT_MOBILE_WEB_CSRF_SECRET="$(cat "$secret_file")"
fi

cd services/api
# This initializer refuses database names other than fluentt_synthetic_staging
# and refuses an unexpected migration revision; it never resets an existing DB.
../../private-data/codespace-api-venv/bin/python -m scripts.init_render_staging_db
exec ../../private-data/codespace-api-venv/bin/python -m uvicorn app.main:app \
  --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*' --no-access-log
