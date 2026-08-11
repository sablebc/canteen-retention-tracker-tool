#!/usr/bin/env bash
# Verify a running deployment is actually reachable and usable over the network.
#
#   ./scripts/preflight.sh 192.168.2.17
#   ./scripts/preflight.sh 192.168.2.17 5173 8001
#
# Run this from a *different machine* than the server whenever possible. Half
# of what it checks — firewall rules, binding to 0.0.0.0 rather than localhost —
# passes trivially when tested from the server itself and fails from anywhere
# else, which is exactly the failure that is hard to diagnose from the browser.
#
# `manage.py check_deploy` inspects the configuration from inside; this checks
# what a browser actually receives. Both are worth running.
set -u

HOST="${1:-}"
FRONTEND_PORT="${2:-5173}"
BACKEND_PORT="${3:-8001}"

if [ -z "$HOST" ]; then
  echo "Usage: $0 <server-host-or-ip> [frontend-port] [backend-port]" >&2
  exit 2
fi

API="http://${HOST}:${BACKEND_PORT}"
APP="http://${HOST}:${FRONTEND_PORT}"
ORIGIN="$APP"

PASS=0
FAIL=0
CURL="curl --silent --max-time 10"

green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
amber() { printf '\033[33m%s\033[0m' "$1"; }

pass() { PASS=$((PASS + 1)); printf '  [%s] %s\n' "$(green PASS)" "$1"; }
warn() { printf '  [%s] %s\n' "$(amber WARN)" "$1"; }
fail() {
  FAIL=$((FAIL + 1))
  printf '  [%s] %s\n' "$(red FAIL)" "$1"
  [ -n "${2:-}" ] && printf '         → %s\n' "$2"
}

echo ""
echo "Preflight against ${HOST}  (frontend :${FRONTEND_PORT}, backend :${BACKEND_PORT})"
echo ""

# --- 1. Can we open a TCP connection to the API at all? ---------------------
# A failure here is never CORS: nothing has been served yet to have headers.
if $CURL --output /dev/null "${API}/api/retention/sites/"; then
  pass "Backend port ${BACKEND_PORT} is reachable"
else
  fail "Cannot connect to ${API}" \
    "The server is not listening on this address. Check the container is up (docker compose ps), that the port is published, and that the firewall allows ${BACKEND_PORT}."
  echo ""
  echo "Stopping: nothing else can be checked until the API answers."
  exit 1
fi

# --- 2. Does ALLOWED_HOSTS accept this hostname? ----------------------------
# A 400 here is the misconfiguration that reaches the browser as "NetworkError",
# because the rejection happens before any CORS header is attached.
STATUS=$($CURL --output /dev/null --write-out '%{http_code}' "${API}/api/retention/sites/")
if [ "$STATUS" = "400" ]; then
  fail "ALLOWED_HOSTS rejects '${HOST}' (HTTP 400)" \
    "Add it to SERVER_HOSTS in .env and restart: docker compose up -d"
elif [ "$STATUS" = "200" ]; then
  pass "ALLOWED_HOSTS accepts '${HOST}'"
else
  fail "Unexpected status ${STATUS} from ${API}/api/retention/sites/" \
    "Check the backend logs: docker compose logs backend"
fi

# --- 3. Does the API return CORS headers for the frontend's origin? ---------
ACAO=$($CURL --header "Origin: ${ORIGIN}" --dump-header - --output /dev/null \
  "${API}/api/retention/sites/" | tr -d '\r' \
  | awk 'tolower($1) == "access-control-allow-origin:" {print $2}')

if [ -z "$ACAO" ]; then
  fail "No Access-Control-Allow-Origin header for origin ${ORIGIN}" \
    "The browser will discard every response. Confirm SERVER_HOSTS includes ${HOST}, then check DJANGO_CORS_ALLOWED_ORIGINS if you set it by hand."
elif [ "$ACAO" = "$ORIGIN" ] || [ "$ACAO" = "*" ]; then
  pass "CORS allows ${ORIGIN}"
else
  fail "CORS allows '${ACAO}', but the frontend's origin is '${ORIGIN}'" \
    "These must match exactly, including scheme and port."
fi

# --- 4. Is the upload endpoint alive? --------------------------------------
# Posting nothing should be rejected by the app's own validation (400 with a
# JSON body), which proves the route and its parser are wired up. A 404 or 405
# would mean something else is answering.
UPLOAD_STATUS=$($CURL --output /dev/null --write-out '%{http_code}' \
  --request POST --header "Origin: ${ORIGIN}" "${API}/api/retention/import/")
if [ "$UPLOAD_STATUS" = "400" ]; then
  pass "Excel import endpoint is accepting uploads"
elif [ "$UPLOAD_STATUS" = "200" ]; then
  warn "Import endpoint returned 200 to an empty POST (unexpected, but reachable)"
else
  fail "Import endpoint returned ${UPLOAD_STATUS}, expected 400 for an empty post" \
    "Seeding from an Excel file will not work. Check: docker compose logs backend"
fi

# --- 5. Has the database been seeded? --------------------------------------
SITES=$($CURL "${API}/api/retention/sites/" | grep --only-matching '"site_id"' | wc -l | tr -d ' ')
if [ "$SITES" -gt 0 ] 2>/dev/null; then
  pass "Database is seeded (${SITES} sites returned)"
else
  warn "No sites returned yet — import a tracker .xlsx to seed the database"
fi

# --- 6. Is the frontend being served? --------------------------------------
if $CURL --output /dev/null "${APP}/"; then
  pass "Frontend port ${FRONTEND_PORT} is reachable"
else
  fail "Cannot connect to ${APP}" \
    "Check the frontend container is up and port ${FRONTEND_PORT} is allowed through the firewall."
fi

echo ""
if [ "$FAIL" -gt 0 ]; then
  printf '%s — open %s in a browser only after these are fixed.\n\n' \
    "$(red "${FAIL} check(s) failed")" "$APP"
  exit 1
fi

printf '%s — open %s\n\n' "$(green "All ${PASS} checks passed")" "$APP"
