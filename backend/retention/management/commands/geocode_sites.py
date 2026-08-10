"""Geocode Sites that have no latitude yet, using OpenStreetMap Nominatim.

Usage::

    python manage.py geocode_sites [--dry-run] [--limit N]

Nominatim's usage policy caps automated clients at one request per second and
requires an identifying User-Agent; both are enforced here via geopy's
``RateLimiter`` and the ``USER_AGENT`` constant. At that rate a full pass over
the tracker takes roughly half an hour, so each site is saved as soon as it
resolves rather than in one closing transaction — an interrupted run keeps the
coordinates it already earned, and re-running picks up where it left off
because the queryset only selects rows still missing a latitude.

``--dry-run`` still performs the lookups (that is the part worth previewing);
it only skips the database write.
"""
from collections import Counter
from dataclasses import dataclass, field

from django.core.management.base import BaseCommand
from geopy.exc import GeocoderQuotaExceeded, GeocoderServiceError
from geopy.extra.rate_limiter import RateLimiter
from geopy.geocoders import Nominatim

from retention.geocoding import (
    build_query_variants,
    extract_province,
    matches_province,
)
from retention.models import Site

# Identifies this client to Nominatim, as its usage policy requires.
USER_AGENT = "canteen-retention-tracker"
# Nominatim allows at most one request per second for automated use.
MIN_DELAY_SECONDS = 1.0
REQUEST_TIMEOUT_SECONDS = 10
# Retries are for transient network faults; a genuine "no match" is not retried.
MAX_RETRIES = 2
ERROR_WAIT_SECONDS = 5.0
# Every tracker address is Canadian, so biasing the search avoids same-named
# streets in other countries winning the match.
COUNTRY_CODES = ["ca"]
# How often to emit a progress line during a long run.
PROGRESS_EVERY = 25

# Human-readable names for the query variants, positionally aligned with
# retention.geocoding.build_query_variants.
VARIANT_LABELS = (
    "matched on street address",
    "matched without postal code",
    "matched on city/province only",
)


@dataclass(frozen=True)
class Failure:
    """One site that could not be resolved, kept for the closing report."""

    site_id: str
    name: str
    address: str
    reason: str


@dataclass
class GeocodeStats:
    """Mutable counters describing one geocoding pass."""

    attempted: int = 0
    succeeded: int = 0
    # Indexed by the position of the query variant that produced the match, so
    # the report can show how much of the result set is street-level.
    resolved_by_variant: Counter = field(default_factory=Counter)
    province_mismatches: int = 0
    failures: list[Failure] = field(default_factory=list)

    @property
    def failed(self) -> int:
        return len(self.failures)


class Command(BaseCommand):
    """Management command entry point."""

    help = "Geocode sites with no coordinates using OpenStreetMap Nominatim."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Perform the lookups and report results without saving.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            metavar="N",
            help="Only process the first N sites, for testing.",
        )

    def handle(self, *args, **options) -> None:
        dry_run = options["dry_run"]
        limit = options["limit"]
        verbosity = options["verbosity"]

        sites = Site.objects.filter(latitude__isnull=True).order_by("site_id")
        total = sites.count()
        if limit is not None:
            sites = sites[:limit]

        selected = sites.count()
        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"\nGeocoding {selected} of {total} site(s) without coordinates"
                f"{' — DRY RUN (nothing saved)' if dry_run else ''}"
            )
        )
        self.stdout.write(
            f"  Rate limit: {MIN_DELAY_SECONDS:.0f} req/s — "
            f"estimated runtime ~{selected * 2 / 60:.0f} min\n"
        )

        geocode = self._build_geocoder()
        stats = GeocodeStats()

        try:
            for index, site in enumerate(sites.iterator(), start=1):
                self._process_site(site, geocode, stats, dry_run, verbosity)
                if verbosity < 2 and index % PROGRESS_EVERY == 0:
                    self.stdout.write(
                        f"  … {index}/{selected} processed "
                        f"({stats.succeeded} resolved, {stats.failed} failed)"
                    )
        except KeyboardInterrupt:
            self.stdout.write(
                self.style.WARNING("\nInterrupted — reporting partial results.")
            )

        self._report(stats, dry_run)

    def _build_geocoder(self):
        """Return a rate-limited Nominatim geocode callable."""
        nominatim = Nominatim(
            user_agent=USER_AGENT,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        return RateLimiter(
            nominatim.geocode,
            min_delay_seconds=MIN_DELAY_SECONDS,
            max_retries=MAX_RETRIES,
            error_wait_seconds=ERROR_WAIT_SECONDS,
            swallow_exceptions=False,
        )

    def _process_site(self, site: Site, geocode, stats: GeocodeStats,
                      dry_run: bool, verbosity: int) -> None:
        """Resolve one site and persist the result unless this is a dry run."""
        stats.attempted += 1

        variants = build_query_variants(site.address)
        if not variants:
            stats.failures.append(
                Failure(site.site_id, site.name, site.address, "no usable address")
            )
            return

        province = extract_province(site.address)
        location, used_variant_index, error, rejected = self._lookup(
            variants, geocode, province
        )
        stats.province_mismatches += rejected

        if location is None:
            stats.failures.append(
                Failure(
                    site.site_id,
                    site.name,
                    site.address,
                    error or "no match from Nominatim",
                )
            )
            if verbosity >= 2:
                self.stdout.write(self.style.WARNING(f"  ✗ {site.name}"))
            return

        stats.succeeded += 1
        stats.resolved_by_variant[used_variant_index] += 1

        if not dry_run:
            site.latitude = location.latitude
            site.longitude = location.longitude
            site.save(update_fields=["latitude", "longitude"])

        if verbosity >= 2 or dry_run:
            prefix = "would set" if dry_run else "set"
            self.stdout.write(
                f"  ✓ {site.name[:48]:<48} {prefix} "
                f"({location.latitude:.5f}, {location.longitude:.5f})"
            )

    def _lookup(self, variants: tuple[str, ...], geocode, province: str):
        """Try each query variant in order, returning the first accepted match.

        A match whose province contradicts the tracker's own province code is
        discarded rather than saved: a confidently-wrong pin is worse on a map
        than a missing one, because nothing downstream flags it.

        Returns:
            A ``(location, variant_index, error, rejected_count)`` tuple.
            ``location`` is None when every variant missed or was rejected.
        """
        last_error = ""
        rejected = 0
        for index, query in enumerate(variants):
            try:
                location = geocode(
                    query, country_codes=COUNTRY_CODES, addressdetails=True
                )
            except GeocoderQuotaExceeded as exc:
                # Backing off further would not help; stop asking for this site.
                return None, index, f"rate limited by Nominatim: {exc}", rejected
            except GeocoderServiceError as exc:
                last_error = f"geocoder error: {exc}"
                continue
            except Exception as exc:  # noqa: BLE001 - one bad row must not kill the run
                last_error = f"{type(exc).__name__}: {exc}"
                continue

            if location is None:
                continue

            state = (location.raw.get("address") or {}).get("state", "")
            if not matches_province(state, province):
                rejected += 1
                last_error = (
                    f"match rejected: Nominatim returned {state!r} "
                    f"but the address says {province!r}"
                )
                continue

            return location, index, "", rejected

        return None, len(variants) - 1, last_error, rejected

    def _report(self, stats: GeocodeStats, dry_run: bool) -> None:
        """Print the closing summary, listing every failure in full."""
        mode = "DRY RUN (nothing saved)" if dry_run else "COMMITTED"
        self.stdout.write(self.style.MIGRATE_HEADING(f"\nGeocoding summary — {mode}"))
        self.stdout.write(f"  Attempted:  {stats.attempted}")
        self.stdout.write(
            self.style.SUCCESS(f"  Successful: {stats.succeeded}")
        )
        for index, label in enumerate(VARIANT_LABELS):
            self.stdout.write(
                f"    - {label:<34} {stats.resolved_by_variant.get(index, 0)}"
            )
        style = self.style.WARNING if stats.failed else self.style.SUCCESS
        self.stdout.write(style(f"  Failed:     {stats.failed}"))
        if stats.province_mismatches:
            self.stdout.write(
                self.style.WARNING(
                    f"  Matches discarded on province mismatch: "
                    f"{stats.province_mismatches}"
                )
            )

        if stats.failures:
            self.stdout.write(self.style.MIGRATE_HEADING("\nFailures"))
            for failure in stats.failures:
                self.stdout.write(
                    self.style.WARNING(f"  [{failure.site_id}] {failure.name}")
                )
                self.stdout.write(f"      address: {failure.address or '(blank)'}")
                self.stdout.write(f"      reason:  {failure.reason}")

        if dry_run:
            self.stdout.write(
                self.style.WARNING("\nDry run — no coordinates were saved.\n")
            )
        else:
            self.stdout.write(self.style.SUCCESS("\nGeocoding complete.\n"))
