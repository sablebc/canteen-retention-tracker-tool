"""Report whether this deployment is configured to work from other machines.

Usage::

    python manage.py check_deploy
    docker compose exec backend python manage.py check_deploy

Complements ``manage.py check --deploy``, which covers Django's generic
hardening advice. This one is about the specific ways *this* app fails on a
LAN: a host list that only covers localhost, CORS origins that disagree with
it, an unseeded database, sites with no coordinates.

Exits non-zero if any check fails, so it can gate a deploy script. Warnings do
not fail the run — an unseeded database is a normal state on first boot.
"""
from django.conf import settings
from django.core.management.base import BaseCommand

from retention.deploy_checks import (
    FAIL,
    OK,
    WARN,
    check_allowed_hosts,
    check_cors_matches_allowed_hosts,
    check_cors_origins,
    check_debug,
    check_geocoding,
    check_secret_key,
    check_seeded,
    check_upload_dir,
)
from retention.models import Site


class Command(BaseCommand):
    help = "Check that this deployment can be reached and used from the LAN."

    def handle(self, *args, **options) -> None:
        results = self._run_checks()

        self.stdout.write(self.style.MIGRATE_HEADING("\nDeployment checks"))
        for result in results:
            self._write(result)

        failures = [result for result in results if result.is_failure]
        warnings = [result for result in results if result.status == WARN]

        self.stdout.write("")
        if failures:
            self.stdout.write(
                self.style.ERROR(
                    f"{len(failures)} check(s) failed — the app will not work "
                    f"correctly from other machines until these are fixed.\n"
                )
            )
            # Signals failure to a calling script without a traceback, which
            # would bury the readable report above it.
            raise SystemExit(1)

        if warnings:
            self.stdout.write(
                self.style.WARNING(
                    f"Configuration is workable, with {len(warnings)} warning(s).\n"
                )
            )
            return

        self.stdout.write(self.style.SUCCESS("All deployment checks passed.\n"))

    def _run_checks(self) -> list:
        """Gather every check, reading the database only once."""
        site_count = Site.objects.count()
        geocoded_count = Site.objects.exclude(latitude=None).count()

        allowed_hosts = list(settings.ALLOWED_HOSTS)
        cors_origins = list(settings.CORS_ALLOWED_ORIGINS)

        return [
            check_secret_key(settings.SECRET_KEY),
            check_debug(settings.DEBUG),
            check_allowed_hosts(allowed_hosts),
            check_cors_origins(cors_origins),
            check_cors_matches_allowed_hosts(cors_origins, allowed_hosts),
            check_upload_dir(settings.TRACKER_UPLOAD_DIR),
            check_seeded(site_count),
            check_geocoding(site_count, geocoded_count),
        ]

    def _write(self, result) -> None:
        """Print one result, coloured by status."""
        style = {
            OK: self.style.SUCCESS,
            WARN: self.style.WARNING,
            FAIL: self.style.ERROR,
        }[result.status]

        self.stdout.write(f"  {style(f'[{result.status:<4}]')} {result.name}")
        self.stdout.write(f"         {result.message}")
