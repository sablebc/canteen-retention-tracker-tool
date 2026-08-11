"""Turning environment variables into the settings that govern network access.

Kept out of ``settings.py`` so the rules can be unit-tested directly, and
because these three settings — ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, and
CSRF_TRUSTED_ORIGINS — are the ones that decide whether a browser elsewhere on
the LAN can talk to this server at all.

They deserve the care because every way of getting them wrong produces the
same symptom. A host missing from ALLOWED_HOSTS returns 400 *without* CORS
headers, so the browser reports a NetworkError rather than a status code; an
origin missing from CORS_ALLOWED_ORIGINS is discarded before JavaScript sees
it, also a NetworkError. The two are indistinguishable from inside the page,
which is why the parsing here is deliberately forgiving about the shapes people
actually paste in — a URL where a bare hostname belongs, a stray space after a
comma — rather than failing silently on them.
"""
from urllib.parse import urlsplit

# ALLOWED_HOSTS accepts this to mean "any host"; CORS does not.
WILDCARD = "*"

# Ports that browsers leave out of the Origin header, and which must therefore
# be left out of the origins we compare against.
DEFAULT_PORTS = {"http": "80", "https": "443"}

DEFAULT_FRONTEND_PORT = "5173"
DEFAULT_BACKEND_PORT = "8001"


def _dedupe(values: list[str]) -> list[str]:
    """Drop repeats while preserving first-seen order."""
    return list(dict.fromkeys(values))


def split_env(raw: str | None) -> list[str]:
    """Split a comma-separated environment variable into clean entries.

    Surrounding whitespace is stripped and empty entries are dropped, so a
    trailing comma or a space after one does not become a hostname that can
    never match.
    """
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def _clean_host(value: str) -> str:
    """Reduce one entry to the bare hostname ALLOWED_HOSTS expects.

    A scheme, port, or path is removed rather than rejected: pasting the URL
    from the browser's address bar is the single most common way to get this
    wrong, and the resulting entry matches nothing while looking correct.
    """
    host = value.strip()
    if not host:
        return ""

    # urlsplit only recognises the authority after a scheme, so supply one.
    if "//" not in host:
        host = f"//{host}"

    hostname = urlsplit(host).hostname or ""
    # urlsplit lowercases and unwraps IPv6 brackets; restore them so the value
    # stays usable as written.
    return f"[{hostname}]" if ":" in hostname else hostname


def parse_hosts(raw: str | None) -> list[str]:
    """Parse a host list into the bare hostnames ALLOWED_HOSTS expects.

    The wildcard is passed through untouched, since it is a valid
    ALLOWED_HOSTS entry rather than a hostname.
    """
    hosts = []
    for entry in split_env(raw):
        if entry == WILDCARD:
            hosts.append(WILDCARD)
            continue
        cleaned = _clean_host(entry)
        if cleaned:
            hosts.append(cleaned)
    return _dedupe(hosts)


def build_origins(hosts: list[str], port: str, scheme: str = "http") -> list[str]:
    """Build the browser origins for ``hosts`` served on ``port``.

    The wildcard is skipped: CORS_ALLOWED_ORIGINS requires literal origins, and
    "http://*:5173" would match no browser on the network. A default port for
    the scheme is omitted, because a browser omits it from the Origin header
    and an origin listed with it would never compare equal.
    """
    default_port = DEFAULT_PORTS.get(scheme)
    origins = [
        f"{scheme}://{host}" if str(port) == default_port else f"{scheme}://{host}:{port}"
        for host in hosts
        if host != WILDCARD
    ]
    return _dedupe(origins)
