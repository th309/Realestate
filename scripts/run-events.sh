#!/bin/bash
# run-events.sh — Direct psql query for content_run_events of the most recent
# (or specified) run. Drop-in replacement for the slow Supabase MCP round-trip
# when watching a live pipeline.
#
# Usage:
#   bash scripts/run-events.sh                  # latest ranking run, all events
#   bash scripts/run-events.sh latest           # same
#   bash scripts/run-events.sh <runId>          # specific run
#   bash scripts/run-events.sh status           # latest run + current status only
#
# Reads SUPABASE_DB_URL from D:/projects/rei-platform/.env.local.
set -euo pipefail

ROOT="D:/projects/rei-platform"
ENV_FILE="$ROOT/.env.local"
PSQL="/c/Program Files/PostgreSQL/17/bin/psql"

if [ ! -f "$ENV_FILE" ]; then
  echo "missing $ENV_FILE" >&2
  exit 1
fi
DB_URL=$(grep '^SUPABASE_DB_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)
DB_URL=${DB_URL%\"}
DB_URL=${DB_URL#\"}
if [ -z "$DB_URL" ]; then
  echo "SUPABASE_DB_URL not set in $ENV_FILE" >&2
  exit 1
fi

ARG="${1:-latest}"

if [ "$ARG" = "status" ]; then
  "$PSQL" "$DB_URL" -X -A -F $'\t' -t -c "
    SELECT id, format, status, NOW() - created_at AS age, status_reason
    FROM content_runs
    WHERE format IN ('top_10_ranking','bottom_10_ranking','score_mover','grade_reveal','head_to_head','farm_area_spotlight')
    ORDER BY created_at DESC
    LIMIT 5;
  " 2>&1
  exit 0
fi

if [ "$ARG" = "latest" ]; then
  RUN_ID=$("$PSQL" "$DB_URL" -X -A -t -c "
    SELECT id::text FROM content_runs
    WHERE format IN ('top_10_ranking','bottom_10_ranking')
    ORDER BY created_at DESC LIMIT 1;
  " | tr -d '[:space:]')
  if [ -z "$RUN_ID" ]; then
    echo "no recent ranking run found" >&2
    exit 1
  fi
else
  RUN_ID="$ARG"
fi

echo "run_id=$RUN_ID"
echo "---"
"$PSQL" "$DB_URL" -X -A -F $'\t' -t -c "
  SELECT
    to_char(created_at AT TIME ZONE 'America/New_York', 'HH24:MI:SS.MS') AS t,
    event_type,
    CASE
      WHEN event_type = 'status_changed' THEN
        coalesce(payload->>'from','?') || ' -> ' || coalesce(payload->>'to','?')
        || coalesce(' ('||(payload->>'reason')||')','')
      WHEN event_type LIKE '%_done' THEN
        substring(payload::text, 1, 240)
      ELSE substring(payload::text, 1, 200)
    END AS detail
  FROM content_run_events
  WHERE run_id = '$RUN_ID'
  ORDER BY created_at;
" 2>&1
echo "---"
"$PSQL" "$DB_URL" -X -A -F $'\t' -t -c "
  SELECT id, status, NOW() - created_at AS age, status_reason
  FROM content_runs WHERE id = '$RUN_ID';
" 2>&1
