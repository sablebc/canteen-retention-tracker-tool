# Canteen Retention Tracker

An internal tool for working the FY26 retention call list. It replaces the
hand-maintained Retention Tracker spreadsheet with a map, a spreadsheet-style
grid, and a per-rep call list - while still being seeded from, and refreshed by,
the same `.xlsx` export.

- **Map** - every geocoded site, coloured by owner and whether it has been called
- **Grid** - all sites as a sortable, filterable, inline-editable table
- **My Calls** - the selected rep's assignments and their progress

The tracker export stays the source of truth for site data. Work done in this
tool (call records, outcome classifications) is kept separate and is never
overwritten by a re-import.

---

## Deploying behind a reverse proxy

The default setup expects a reverse proxy such as Nginx Proxy Manager. Neither
container publishes a port; the proxy reaches the frontend, and the frontend
proxies `/api`, `/admin`, and `/static` onward to the backend itself.

That means the whole app lives at **one address**. The browser only ever talks
to a single origin, so its requests are same-origin and CORS is never consulted
- not "configured correctly", but not involved at all.

```bash
git clone https://github.com/sablebc/canteen-retention-tracker-tool.git
cd canteen-retention-tracker-tool
cp .env.example .env
```

Edit `.env`:

```bash
PUBLIC_ORIGIN=http://canteen.lan     # the address people will type
DJANGO_SECRET_KEY=...                # python3 -c "import secrets; print(secrets.token_urlsafe(64))"
NPM_NETWORK=npm_default              # the Docker network your proxy runs on
```

Find your proxy's network with:

```bash
docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' <npm-container>
```

Then:

```bash
docker compose up -d --build
```

In Nginx Proxy Manager, add **one** proxy host. No custom locations are needed:

| Field | Value |
|---|---|
| Domain Names | `canteen.lan` (matching `PUBLIC_ORIGIN`) |
| Scheme | `http` |
| Forward Hostname / IP | `canteen-frontend` |
| Forward Port | `80` |
| Websockets Support | off |

Under the proxy host's **Advanced** tab, allow the tracker upload through:

```
client_max_body_size 32m;
```

Finally, verify from another machine:

```bash
./scripts/preflight.sh http://canteen.lan
```

### Why PUBLIC_ORIGIN matters

A reverse proxy forwards the browser's `Host` header unchanged, and Django
refuses any host it was not told about - answering **400 before any other
middleware runs**. The browser reports that only as:

> NetworkError when attempting to fetch resource

`PUBLIC_ORIGIN` is what tells Django to accept the name. It also becomes the
CSRF trusted origin, and switching it to `https://` turns on the proxy-aware
TLS settings by itself. It is the one value that has to be right.

### Serving without a proxy

To publish a port directly instead:

```bash
# set SERVER_HOSTS=192.168.2.17,localhost in .env first
docker compose -f docker-compose.direct.yml up -d --build
sudo ufw allow 5173/tcp
./scripts/preflight.sh 192.168.2.17
```

Only the frontend publishes a port; it still proxies `/api` internally, so this
is single-origin too and the backend never needs to be reachable directly.

---

## Seeding the database from the Excel tracker

The `.xlsx` is deliberately **not** in the repo - it holds live customer data.
Copy it to the server yourself, then use either route.

**From the app (the normal way):** click **Import / Update** in the header and
choose the file. The upload is stored, the ingest runs, and a summary of what
changed is shown. This is also how you refresh the data later.

**From the command line:**

```bash
docker cp ./Retention_Tracker.xlsx canteen-backend:/data/uploads/
docker compose exec backend python manage.py ingest_tracker /data/uploads/Retention_Tracker.xlsx
```

Add `--dry-run` to see exactly what would change without writing anything.

A typical first import of the current tracker loads ~905 sites, ~660 historical
call rows, and ~490 rep assignments.

### Re-importing is safe

Sites are upserted on the tracker's `#` column, so a second import updates in
place rather than duplicating. Specifically preserved across a re-import:

- **Call records logged in this tool** (`source="app"`) - only imported rows are
  refreshed
- **Call outcome classifications** - owned by this tool, absent from the export
- **Geocoded coordinates** - never touched by the ingest

`StatusHistory` is the one append-only table: each run adds a row per site, so
account-status changes stay queryable as a trend.

### Putting the sites on the map

Coordinates are not in the tracker; they are looked up from the addresses:

```bash
docker compose exec backend python manage.py geocode_sites
```

OpenStreetMap's Nominatim allows one request per second, so a full pass over 905
sites takes **about 30 minutes**. Each site is saved as it resolves, so an
interrupted run keeps its progress and re-running picks up where it stopped.
Until this runs, the map is empty while the Grid and My Calls views work
normally.

---

## Checking a deployment

Two complementary checks - run both.

```bash
# From inside: configuration, seed state, geocoding coverage
docker compose exec backend python manage.py check_deploy

# From outside: routing, hostname acceptance, uploads, static files
./scripts/preflight.sh http://canteen.lan
```

`check_deploy` catches configuration that looks correct but is not - a proxy
hostname missing from `ALLOWED_HOSTS`, a placeholder secret key, an unseeded
database. It also runs on every container start, so the result is in
`docker compose logs backend`.

`preflight.sh` checks what a browser actually receives, which is the only way to
catch a closed firewall port, a proxy pointed at the wrong container, or a
hostname that does not resolve. Run it from another machine when you can;
several of its checks pass trivially on the server itself.

---

## Local development

Backend:

```bash
cd backend
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
cp .env.example .env
./venv/bin/python manage.py migrate
./venv/bin/python manage.py ingest_tracker ../data/raw/Retention_Tracker.xlsx
./venv/bin/python manage.py runserver 8001
```

Frontend:

```bash
cd frontend
npm install
npm run dev          # localhost only
npm run dev:lan      # reachable from other machines on the network
```

In development the two run on separate ports, so the frontend calls the API
cross-origin and CORS does apply. `SERVER_HOSTS` and `FRONTEND_PORT` drive the
allowed origins; the defaults cover `localhost:5173`.

`runserver` and `vite` are development servers - use the Docker setup for
anything others rely on.

Tests:

```bash
cd backend && ./venv/bin/python manage.py test
cd frontend && npm run lint
```

---

## Who am I?

There is no authentication yet. The rep dropdown in the header decides whose
sites count as "mine" across every view and who a logged call is attributed to.
The choice is remembered per browser.

This is **not** a security boundary - anyone can select any rep, and every
endpoint is open to anyone who can reach the app. That is a deliberate
trade-off for a trusted internal network; do not expose this deployment to the
internet.

---

## Layout

```
backend/                  Django + DRF
  config/                 settings, URL roots, environment parsing
  retention/              models, API, tracker ingest, geocoding, deploy checks
  analysis/               revenue-risk scoring (stub; returns 501)
frontend/                 React + Vite + Tailwind, MapLibre, AG Grid
  nginx.conf              serves the SPA and proxies /api to the backend
data/raw/                 drop tracker exports here (gitignored)
scripts/preflight.sh      check a running deployment from outside
docker-compose.yml        behind a reverse proxy (default)
docker-compose.direct.yml published port, no proxy
```

Data lives on the `retention-data` Docker volume - the SQLite database and every
uploaded export. It survives `docker compose down` and image rebuilds. To back it
up, copy `/data/db.sqlite3` out of the backend container.
