"""Checks that answer "will this actually work once it is on the server?".

Each check is a pure function returning a :class:`CheckResult`, so the rules
can be tested without a running server and reused by both the management
command and anything else that wants them.

The bias here is towards catching configuration that *looks* fine and fails
silently. A browser given a 400 from ALLOWED_HOSTS and a browser given a
response with no CORS headers both report the same opaque "NetworkError", with
nothing in the app's own logs or UI to tell them apart — so the mismatch has to
be found before it is deployed rather than diagnosed afterwards.
"""
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

OK = "OK"
WARN = "WARN"
FAIL = "FAIL"

# Addresses that only ever reach the machine the browser is running on.
LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "0.0.0.0", "[::1]"})

# Anything at or below this length is a placeholder, not a generated key.
MIN_SECRET_KEY_LENGTH = 50

INSECURE_KEY_PREFIX = "django-insecure-"


@dataclass(frozen=True)
class CheckResult:
    """One check's verdict, with a message written to be acted on."""

    name: str
    status: str
    message: str

    @property
    def is_failure(self) -> bool:
        return self.status == FAIL


def check_debug(debug: bool) -> CheckResult:
    """DEBUG on a reachable server exposes tracker data in stack traces."""
    if debug:
        return CheckResult(
            "DEBUG",
            WARN,
            "DEBUG is on. Error pages will show site names, contacts, and "
            "revenue to anyone who can reach this server. Set DJANGO_DEBUG=False "
            "once the deployment works.",
        )
    return CheckResult("DEBUG", OK, "DEBUG is off.")


def check_secret_key(secret_key: str) -> CheckResult:
    """A shipped-with-the-repo key makes signed cookies forgeable."""
    if secret_key.startswith(INSECURE_KEY_PREFIX):
        return CheckResult(
            "SECRET_KEY",
            FAIL,
            "SECRET_KEY is still the development placeholder. Generate one with: "
            'python -c "import secrets; print(secrets.token_urlsafe(64))"',
        )
    if len(secret_key) < MIN_SECRET_KEY_LENGTH:
        return CheckResult(
            "SECRET_KEY",
            FAIL,
            f"SECRET_KEY is only {len(secret_key)} characters; use at least "
            f"{MIN_SECRET_KEY_LENGTH}.",
        )
    return CheckResult("SECRET_KEY", OK, "SECRET_KEY is set to a real value.")


def check_allowed_hosts(hosts: list[str]) -> CheckResult:
    """Requests arriving under any other host name are answered with 400."""
    if not hosts:
        return CheckResult(
            "ALLOWED_HOSTS",
            FAIL,
            "ALLOWED_HOSTS is empty; every request will be rejected. Set "
            "SERVER_HOSTS to this machine's address.",
        )

    if "*" in hosts:
        return CheckResult(
            "ALLOWED_HOSTS",
            WARN,
            "ALLOWED_HOSTS is wildcarded. That works, but it accepts any Host "
            "header; prefer listing this server's address in SERVER_HOSTS.",
        )

    routable = [host for host in hosts if host not in LOOPBACK_HOSTS]
    if not routable:
        return CheckResult(
            "ALLOWED_HOSTS",
            WARN,
            "ALLOWED_HOSTS only covers localhost, so this server answers 400 to "
            "every browser on another machine — which appears there as an "
            "unexplained 'NetworkError'. Set SERVER_HOSTS to the LAN address.",
        )

    return CheckResult(
        "ALLOWED_HOSTS", OK, f"Accepting requests for: {', '.join(hosts)}"
    )


def check_cors_origins(origins: list[str]) -> CheckResult:
    """CORS entries must be bare scheme://host[:port] origins, or they never match."""
    if not origins:
        return CheckResult(
            "CORS_ALLOWED_ORIGINS",
            FAIL,
            "No CORS origins configured; the frontend's requests will all be "
            "discarded by the browser.",
        )

    malformed = []
    for origin in origins:
        parts = urlsplit(origin)
        if not parts.scheme or not parts.netloc or parts.path or parts.query:
            malformed.append(origin)

    if malformed:
        return CheckResult(
            "CORS_ALLOWED_ORIGINS",
            FAIL,
            f"Not valid origins: {', '.join(malformed)}. Each must be exactly "
            "scheme://host:port, with no trailing slash or path.",
        )

    return CheckResult(
        "CORS_ALLOWED_ORIGINS", OK, f"Allowing: {', '.join(origins)}"
    )


def check_cors_matches_allowed_hosts(
    origins: list[str], hosts: list[str]
) -> CheckResult:
    """Every CORS origin's host must also be an allowed host.

    When it is not, the request is rejected by the host check *before* the CORS
    middleware attaches its headers — so the browser sees a header-less 400 and
    reports a bare network failure. Allowing the origin without allowing the
    host is therefore worse than allowing neither: it looks configured.
    """
    if "*" in hosts:
        return CheckResult(
            "CORS/ALLOWED_HOSTS agreement",
            OK,
            "ALLOWED_HOSTS is wildcarded, so every CORS origin is reachable.",
        )

    allowed = set(hosts)
    orphans = [
        origin
        for origin in origins
        if (urlsplit(origin).hostname or "") not in allowed
    ]

    if orphans:
        missing = sorted(
            {urlsplit(origin).hostname or "" for origin in orphans}
        )
        return CheckResult(
            "CORS/ALLOWED_HOSTS agreement",
            FAIL,
            f"These origins are allowed by CORS but their hosts are not in "
            f"ALLOWED_HOSTS: {', '.join(orphans)}. Requests from them are "
            f"answered 400 before any CORS header is added, which the browser "
            f"reports only as a network failure. Add to SERVER_HOSTS: "
            f"{', '.join(missing)}",
        )

    return CheckResult(
        "CORS/ALLOWED_HOSTS agreement",
        OK,
        "Every allowed origin's host is also an allowed host.",
    )


def check_upload_dir(path: Path) -> CheckResult:
    """The import endpoint writes here before handing the file to the ingest."""
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".write-test"
        probe.write_text("")
        probe.unlink()
    except OSError as exc:
        return CheckResult(
            "Upload directory",
            FAIL,
            f"Cannot write to {path}: {exc}. Tracker imports will fail.",
        )
    return CheckResult("Upload directory", OK, f"{path} is writable.")


def check_seeded(site_count: int) -> CheckResult:
    """An empty database is a working deployment with nothing to show."""
    if site_count == 0:
        return CheckResult(
            "Seed data",
            WARN,
            "No sites in the database yet. Import a tracker export with the "
            "Import / Update button, or run: manage.py ingest_tracker <file.xlsx>",
        )
    return CheckResult("Seed data", OK, f"{site_count} sites loaded.")


def check_geocoding(site_count: int, geocoded_count: int) -> CheckResult:
    """Sites without coordinates are simply absent from the map view."""
    if site_count == 0 or geocoded_count >= site_count:
        return CheckResult(
            "Geocoding", OK, f"{geocoded_count}/{site_count} sites have coordinates."
        )

    missing = site_count - geocoded_count
    return CheckResult(
        "Geocoding",
        WARN,
        f"{missing} of {site_count} sites have no coordinates and will not "
        f"appear on the map. Run: manage.py geocode_sites  (about "
        f"{max(1, round(missing / 60))} min at Nominatim's 1 req/s limit)",
    )
