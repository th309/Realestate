#!/usr/bin/env bash
#
# Manual trial walkthrough control tool.
#
# Drive ONE real account through the 14-day trial at your own pace: advance the
# trial clock to any day and send that day's email, on demand. Use it alongside
# the app in your browser (http://localhost:3000) to watch the trial state,
# tracking, suggestions, and emails for yourself.
#
# Requires the LOCAL backend running with DEV_WALKTHROUGH_ENABLED=true (the
# dev-only endpoints) and RESEND_API_KEY set (so emails actually send).
# Reads Supabase keys from .env.local. Every email is scoped to the one email
# you pass — it never touches other users.
#
# Usage:
#   scripts/trial-walkthrough.sh status <email>
#   scripts/trial-walkthrough.sh jump   <email> <day>   # day ∈ 0 1 3 5 7 10 13 15
#   scripts/trial-walkthrough.sh advance <email> <day>  # move clock only, no email
#   scripts/trial-walkthrough.sh email  <email> <job>   # send one email by name
#   scripts/trial-walkthrough.sh reset  <email>         # delete the test account
#
#   day → email sent by `jump`:
#     0=welcome  1=drip1  3=drip3  5=drip5  7=drip7
#     10=trial_day_10 ("4 days left")  13=trial_day_13 ("last chance")
#     15=trial_expired ("trial ended")
#
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
getval() { grep -m1 -E "^$1=" "$ENV_FILE" | sed -E "s/^$1=//" | tr -d '\r'; }
URL="$(getval NEXT_PUBLIC_SUPABASE_URL)"
SK="$(getval SUPABASE_SERVICE_KEY)"
ANON="$(getval NEXT_PUBLIC_SUPABASE_ANON_KEY)"
OWNER_EMAIL="${ADMIN_OWNER_EMAIL:-troyhouston76@gmail.com}"
API="${BACKEND_URL:-http://localhost:3001}/api/admin/dev/trial-walkthrough"
SA=(-H "apikey: $SK" -H "authorization: Bearer $SK")

cmd="${1:-}"; email="${2:-}"
[ -z "$cmd" ] && { sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }
[ -z "$email" ] && { echo "error: <email> required"; exit 1; }
enc_email="$(printf '%s' "$email" | sed 's/+/%2B/')"

userid() {
  curl -s "${SA[@]}" "$URL/rest/v1/user_profiles?email=eq.$enc_email&select=id" \
    | grep -oE '[0-9a-f-]{36}' | head -1
}

# Mint an admin bearer (the dev endpoints sit behind AdminGuard).
admin_token() {
  local gen hash
  gen="$(curl -s "${SA[@]}" -H 'content-type: application/json' \
    -d "{\"type\":\"magiclink\",\"email\":\"$OWNER_EMAIL\"}" \
    "$URL/auth/v1/admin/generate_link")"
  hash="$(printf '%s' "$gen" | grep -oE '"hashed_token":"[^"]+"' | sed -E 's/.*:"//; s/"$//')"
  curl -s -H "apikey: $ANON" -H 'content-type: application/json' \
    -d "{\"type\":\"magiclink\",\"token_hash\":\"$hash\"}" "$URL/auth/v1/verify" \
    | grep -oE '"access_token":"[^"]+"' | sed -E 's/.*:"//; s/"$//'
}

day_to_job() {
  case "$1" in
    0) echo welcome;; 1) echo drip1;; 3) echo drip3;; 5) echo drip5;; 7) echo drip7;;
    10) echo trial_day_10;; 13) echo trial_day_13;; 15) echo trial_expired;;
    *) echo "";;
  esac
}

UID2="$(userid)"

case "$cmd" in
  status)
    [ -z "$UID2" ] && { echo "no account for $email (sign up first at http://localhost:3000/auth/sign-up)"; exit 0; }
    echo "user: $UID2"
    echo "trial:"; curl -s "${SA[@]}" "$URL/rest/v1/user_trials?user_id=eq.$UID2&select=tier,started_at,expires_at,converted_at,cancelled_at"
    echo ""; echo "emails sent (email_log):"
    curl -s "${SA[@]}" "$URL/rest/v1/email_log?user_id=eq.$UID2&select=email_type,subject"
    ;;
  advance|jump)
    day="${3:-}"; [ -z "$day" ] && { echo "error: <day> required"; exit 1; }
    [ -z "$UID2" ] && { echo "no account for $email — sign up first"; exit 1; }
    tok="$(admin_token)"
    echo "advancing $email to trial day $day ..."
    curl -s -X POST "$API/advance" -H 'content-type: application/json' \
      -H "authorization: Bearer $tok" -d "{\"userId\":\"$UID2\",\"toDay\":$day}" ; echo ""
    if [ "$cmd" = "jump" ]; then
      job="$(day_to_job "$day")"
      [ -z "$job" ] && { echo "no email mapped to day $day (use one of 0 1 3 5 7 10 13 15)"; exit 0; }
      echo "sending '$job' email to $email ..."
      curl -s -X POST "$API/fire" -H 'content-type: application/json' \
        -H "authorization: Bearer $tok" -d "{\"job\":\"$job\",\"userId\":\"$UID2\"}" ; echo ""
      echo "→ check $email; reload the app to see day-$day trial state."
    fi
    ;;
  email)
    job="${3:-}"; [ -z "$job" ] && { echo "error: <job> required"; exit 1; }
    [ -z "$UID2" ] && { echo "no account for $email"; exit 1; }
    tok="$(admin_token)"
    curl -s -X POST "$API/fire" -H 'content-type: application/json' \
      -H "authorization: Bearer $tok" -d "{\"job\":\"$job\",\"userId\":\"$UID2\"}" ; echo ""
    echo "→ sent '$job' to $email"
    ;;
  reset)
    [ -z "$UID2" ] && { echo "nothing to reset for $email"; exit 0; }
    tok="$(admin_token)"
    curl -s -X DELETE "$API/user/$UID2" -H "authorization: Bearer $tok" ; echo ""
    echo "→ deleted $email"
    ;;
  *) echo "unknown command: $cmd"; exit 1;;
esac
