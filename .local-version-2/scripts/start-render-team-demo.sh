#!/usr/bin/env bash
set -euo pipefail

# This public team demonstration is ordinary Class Learning only.
# Research execution is not authorized by deployment or environment toggles.
export FLUENTT_PARALLEL_RESEARCH_ENABLED=false
export FLUENTT_PARALLEL_TEST_WORKFLOWS_ENABLED=false
export FLUENTT_PERSONAL_LEARNER_REGISTRATION_ENABLED=false
export FLUENTT_ASSIGNMENT_RESULTS_ON_SUBMIT=false
if [[ "${GROQ_TUTOR_TEAM_DEMO:-}" == "true" ]]; then
  export GROQ_TUTOR_TEAM_DEMO_ALL_ACCOUNTS=true
fi

cd services/api
if [[ "${FLUENTT_DATABASE_URL:-}" == postgresql://* ]]; then
  export FLUENTT_DATABASE_URL="postgresql+psycopg://${FLUENTT_DATABASE_URL#postgresql://}"
fi
python -m scripts.check_team_demo_db
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-10000}" --proxy-headers --forwarded-allow-ips='*' --no-access-log
