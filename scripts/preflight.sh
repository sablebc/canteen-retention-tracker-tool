#!/usr/bin/env bash
# Verify a running deployment is reachable and usable from the network.
#
#   ./scripts/preflight.sh http://canteen.lan      # behind a reverse proxy
#   ./scripts/preflight.sh 192.168.2.17            # published port (default 5173)
#   ./scripts/preflight.sh 192.168.2.17 5173
#
# Run this from a *different machine* than the server whenever possible. Half
# of what it checks - firewall rules, proxy routing, DNS for the hostname -
# passes trivially when tested from the server itself and fails from anywhere
# else, which is precisely the failure that is hard to read from a browser.
#
# `manage.py check_deploy` inspects the configuration from inside the
# container; this checks what a browser actually receives. Both are worth
# running, and they catch different things.
set -u

TARGET="${1:-}"
PORT="${2:-5173}"

if [ -z "$TARGET" ]; then
  echo "Usage: $0 <url-or-host> [port]" >&2
  echo "  e.g. $0 http://canteen.lan" >&2
  echo "       $0 192.168.2.17 5173" >&2
  exit 2
fi

# A bare host means a directly published port; a URL means a proxy in front.
case "$TARGET" in
  http://*|https://*) BASE="${TARGET%/}" ; MODE="reverse proxy" ;;
  *)                  BASE="http://${TARGET}:${PORT}" ; MODE="published port" ;;
esac

PASS=0
FAIL=0
CURL="curl --silent --max-time 15"

green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
amber() { printf '\033[33m%s\033[0m' "$1"; }

pass() { PASS=$((PASS + 1)); printf '  [%s] %s\n' "$(green PASS)" "$1"; }
warn() { printf '  [%s] %s\n' "$(amber WARN)" "$1"; }
fail() {
  FAIL=$((FAIL + 1))
  printf '  [%s] %s\n' "$(red FAIL)" "$1"
  [ -n "${2:-}" ] && printf '         -> %s\n' "$2"
}

status_of() { $CURL --output /dev/null --write-out '%{http_code}' "$1"; }

echo ""
echo "Preflight against ${BASE}  (${MODE})"
echo ""

# --- 1. Does anything answer at all? ---------------------------------------
# A failure here is never CORS and never ALLOWED_HOSTS: no HTTP response has
# been produced yet for either to apply to.
if ! $CURL --output /dev/null "${BASE}/"; then
  fail "Cannot connect to ${BASE}" \
    "Nothing is answering. Check the containers are up (docker compose ps), that the proxy points at canteen-frontend:80, that the hostname resolves, and that any firewall allows the port."
  echo ""
  echo "Stopping: nothing else can be checked until the app answers."
  exit 1
fi
pass "App is reachable at ${BASE}"

# --- 2. Is the SPA itself being served? ------------------------------------
if $CURL "${BASE}/" | grep -qi "<div id=\"root\">"; then
  pass "Frontend is serving the application"
else
  fail "The root URL answered, but it does not look like the app" \
    "Something else may be responding at this address - check the proxy's forward host and port."
fi

# --- 3. Does the API answer through the same origin? -----------------------
# 400 here is the ALLOWED_HOSTS rejection: the proxy forwards the browser's
# Host, and Django refuses names it was not told about. It is the single most
# common reason this deployment appears broken.
API_STATUS=$(status_of "${BASE}/api/retention/sites/")
case "$API_STATUS" in
  200) pass "API is reachable at ${BASE}/api (same origin, so CORS never applies)" ;;
  400) fail "Django rejected the hostname (HTTP 400)" \
         "Set PUBLIC_ORIGIN to ${BASE} in .env and restart: docker compose up -d" ;;
  404) fail "No API at ${BASE}/api (HTTP 404)" \
         "The frontend container should proxy /api to the backend. Check its nginx.conf reached the image." ;;
  502|503|504) fail "Proxy could not reach the backend (HTTP ${API_STATUS})" \
         "The backend container is probably down or unhealthy: docker compose ps; docker compose logs backend" ;;
  *)   fail "Unexpected status ${API_STATUS} from ${BASE}/api/retention/sites/" \
         "Check the logs: docker compose logs backend" ;;
esac

# --- 4. Is the upload endpoint alive? --------------------------------------
# Posting nothing should be refused by the app's own validation, which proves
# the route and its multipart parser are wired up. A 404 or 405 means
# something else is answering.
UPLOAD_STATUS=$($CURL --output /dev/null --write-out '%{http_code}' \
  --request POST "${BASE}/api/retention/import/")
if [ "$UPLOAD_STATUS" = "400" ]; then
  pass "Excel import endpoint is accepting uploads"
elif [ "$UPLOAD_STATUS" = "413" ]; then
  fail "The proxy rejected the request as too large (HTTP 413)" \
    "Raise the upload limit: client_max_body_size in the proxy, and in NPM the 'Advanced' tab of the proxy host."
else
  fail "Import endpoint returned ${UPLOAD_STATUS}, expected 400 for an empty post" \
    "Seeding from Excel will not work. Check: docker compose logs backend"
fi

# --- 5. Has the database been seeded? --------------------------------------
SITES=$($CURL "${BASE}/api/retention/sites/" | grep --only-matching '"site_id"' | wc -l | tr -d ' ')
if [ "${SITES:-0}" -gt 0 ] 2>/dev/null; then
  pass "Database is seeded (${SITES} sites returned)"
else
  warn "No sites returned yet - import a tracker .xlsx to seed the database"
fi

# --- 6. Admin and its static files ------------------------------------------
# Also proves collectstatic ran and /static/ is routed, which is otherwise only
# discovered by finding the admin unstyled.
ADMIN_STATUS=$(status_of "${BASE}/admin/login/")
if [ "$ADMIN_STATUS" = "200" ]; then
  pass "Django admin is reachable"
else
  warn "Admin returned ${ADMIN_STATUS} at ${BASE}/admin/login/"
fi

CSS_STATUS=$(status_of "${BASE}/static/admin/css/base.css")
if [ "$CSS_STATUS" = "200" ]; then
  pass "Static files are being served"
else
  warn "Static files returned ${CSS_STATUS}; the admin will appear unstyled"
fi

echo ""
if [ "$FAIL" -gt 0 ]; then
  printf '%s - open %s only after these are fixed.\n\n' \
    "$(red "${FAIL} check(s) failed")" "$BASE"
  exit 1
fi

printf '%s - open %s\n\n' "$(green "All ${PASS} checks passed")" "$BASE"
