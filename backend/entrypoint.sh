#!/bin/sh
# Bring the database and static files up to date, then hand off to gunicorn.
#
# Migrations run on every start rather than as a separate deploy step: the
# database is a SQLite file on a volume, so "has this one been migrated yet?"
# is otherwise a question the operator has to remember to ask. Migrations are
# idempotent, so a restart with nothing pending is a no-op.
set -e

echo "==> Applying migrations"
python manage.py migrate --noinput

echo "==> Collecting static files"
python manage.py collectstatic --noinput --clear >/dev/null

echo "==> Checking deployment configuration"
# Reports problems but does not block startup: a warning about seeding or
# geocoding should be visible in the logs, not a reason to refuse to boot.
python manage.py check_deploy || true

exec "$@"
