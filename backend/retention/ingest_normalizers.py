"""Pure value-normalisation helpers for the Retention Tracker import.

The tracker is hand-maintained, so almost every column carries free text with
inconsistent casing, delimiters, and placeholder values. Every function here is
side-effect free and returns ``None`` (or an empty string) rather than raising,
so a single malformed cell degrades one field instead of failing a whole run.
"""
import hashlib
import re
from datetime import date, datetime, time, timedelta
from decimal import Decimal, InvalidOperation

# Synthetic site IDs are prefixed so they are obvious in the database and can
# never collide with the tracker's own numeric '#' values.
SYNTHETIC_ID_PREFIX = "syn-"
SYNTHETIC_ID_HEX_LENGTH = 16

# Rep initials are short alphabetic codes ("CM", "AJ"). Anything longer is a
# stray note typed into the RS column, not an assignment.
_REP_INITIALS = re.compile(r"^[A-Za-z][A-Za-z0-9.\-]{0,7}$")

# Canonical account statuses. Kept deliberately small; the unmatched remainder
# lands in "Unknown" rather than growing a long tail of near-duplicates.
STATUS_ACTIVE = "Active"
STATUS_INACTIVE = "Inactive"
STATUS_POTENTIAL = "Potential"
STATUS_UNDEPLOYED = "Undeployed/Removed"
STATUS_UNKNOWN = "Unknown"

# Ordered: the first pattern to match wins. Order matters more than the
# patterns themselves — "Active | Coffee Order Potential" must resolve to
# Active, and the inactive rule must be tried before the active one.
_STATUS_RULES = (
    (re.compile(r"undeploy|removed|decommission|de-commission", re.I), STATUS_UNDEPLOYED),
    (
        re.compile(
            r"\binactive\b|\bnot\s+active\b|\bnon[-\s]?active\b|\bdormant\b"
            r"|\blost\b|\bceased\b|\bclosed\b",
            re.I,
        ),
        STATUS_INACTIVE,
    ),
    (re.compile(r"\bactive\b|\blive\b|\bcurrent\b", re.I), STATUS_ACTIVE),
    (re.compile(r"\bpotential\b|\bprospect\b|\blead\b", re.I), STATUS_POTENTIAL),
)

# Line-of-business keywords, scanned in position order within each chunk so
# that a run-on value like "OCS Vend" yields both parts in their original order.
_LOB_KEYWORDS = (
    (re.compile(r"\bocs\b", re.I), "OCS"),
    (re.compile(r"\bmicro\s*markets?\b", re.I), "Micro Market"),
    (re.compile(r"\bvend(?:ing|s)?\b", re.I), "Vending"),
    (re.compile(r"\bcoffee\b", re.I), "Coffee"),
    (re.compile(r"\bwater\b", re.I), "Water"),
)

_LOB_SPLIT = re.compile(r"[/,&+;|\n\r]+")

# Placeholder cell values that mean "no value", not a parse failure.
_NULL_TOKENS = frozenset(
    {"", "n/a", "na", "n.a.", "none", "null", "-", "--", "?", "tbc", "tbd", "unknown"}
)

# Day-first is tried before month-first: the tracker is UK-style ("Last Order
# Date" values such as 05/08/2026 read as 5 August). Ambiguous values are
# reported by the command so the assumption can be spot-checked.
_DATE_FORMATS = (
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d.%m.%Y",
    "%d/%m/%y",
    "%d-%b-%Y",
    "%d-%b-%y",
    "%d %b %Y",
    "%d %B %Y",
    "%b %d, %Y",
    "%B %d, %Y",
    "%m/%d/%Y",
)

_AMBIGUOUS_DATE = re.compile(r"^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\s*$")

_CURRENCY_STRIP = re.compile(r"[^\d.\-]")
_HOURS = re.compile(r"(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b", re.I)
_MINUTES = re.compile(r"(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b", re.I)
_CLOCK = re.compile(r"^\s*(\d{1,2}):([0-5]\d)(?::([0-5]\d))?\s*$")
_FIRST_NUMBER = re.compile(r"-?\d+(?:\.\d+)?")

MIN_RATING = 1
MAX_RATING = 5
_MINUTES_PER_HOUR = 60


def clean_text(value) -> str:
    """Return a cell as trimmed text, collapsing whitespace and dropping nulls.

    Numeric cells are rendered without a trailing ``.0`` so identifiers and
    phone numbers survive Excel's habit of storing them as floats.
    """
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        text = str(int(value))
    elif isinstance(value, (datetime, date)):
        text = value.isoformat()
    else:
        text = str(value)

    text = re.sub(r"\s+", " ", text).strip()
    return "" if text.lower() in _NULL_TOKENS else text


def is_null_token(value) -> bool:
    """True when a cell is empty or a recognised placeholder such as 'N/A'."""
    if value is None:
        return True
    return str(value).strip().lower() in _NULL_TOKENS


def normalize_site_id(value) -> str:
    """Render the '#' column as a stable string key.

    Excel may hand back ``1234``, ``1234.0``, or ``" 1234 "`` for the same
    cell; all three must produce the same upsert key.
    """
    return clean_text(value)


def normalize_status(raw) -> str:
    """Map a free-text account status onto the canonical set.

    Returns ``"Unknown"`` for blank or unrecognised values rather than
    guessing, so the raw string remains the only source of nuance.
    """
    text = clean_text(raw)
    if not text:
        return STATUS_UNKNOWN

    for pattern, canonical in _STATUS_RULES:
        if pattern.search(text):
            return canonical
    return STATUS_UNKNOWN


def normalize_lob(raw) -> str:
    """Normalise line-of-business casing and delimiters to a comma-joined list.

    ``"OCS/Vending"``, ``"VENDING"``, and ``"OCS Vend"`` become ``"OCS,
    Vending"``, ``"Vending"``, and ``"OCS, Vending"`` respectively. Chunks with
    no recognised keyword are kept, title-cased, rather than discarded.
    """
    text = clean_text(raw)
    if not text:
        return ""

    parts: list[str] = []
    for chunk in _LOB_SPLIT.split(text):
        chunk = chunk.strip()
        if not chunk:
            continue

        matches = [
            (match.start(), label)
            for pattern, label in _LOB_KEYWORDS
            for match in [pattern.search(chunk)]
            if match
        ]
        if matches:
            parts.extend(label for _, label in sorted(matches))
        else:
            parts.append(chunk.title())

    # Dedupe while preserving first-seen order.
    return ", ".join(dict.fromkeys(parts))


def parse_date(value) -> tuple[date | None, bool]:
    """Parse a Last Order Date cell into a date.

    Handles real datetimes, ``'*'``-prefixed strings, ``'N/A'``, and blanks.

    Returns:
        A ``(parsed_date, was_unparseable)`` pair. ``(None, False)`` means the
        cell was legitimately empty; ``(None, True)`` means it held content
        that could not be understood and is worth reporting.
    """
    if isinstance(value, datetime):
        return value.date(), False
    if isinstance(value, date):
        return value, False
    if is_null_token(value):
        return None, False

    # Leading '*' marks an estimated/annotated date in the tracker.
    text = str(value).strip().lstrip("*").strip()
    if not text or text.lower() in _NULL_TOKENS:
        return None, False

    try:
        return datetime.fromisoformat(text).date(), False
    except ValueError:
        pass

    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date(), False
        except ValueError:
            continue
    return None, True


def is_ambiguous_date(value) -> bool:
    """True when a textual date could read as either day-first or month-first.

    Used purely for reporting: ``05/08/2026`` is genuinely ambiguous, whereas
    ``23/08/2026`` can only be day-first.
    """
    if isinstance(value, (datetime, date)) or is_null_token(value):
        return False
    match = _AMBIGUOUS_DATE.match(str(value).strip().lstrip("*"))
    if not match:
        return False
    first, second = int(match.group(1)), int(match.group(2))
    return first <= 12 and second <= 12 and first != second


def parse_decimal(value) -> Decimal | None:
    """Parse a revenue cell, tolerating currency symbols, commas, and (negatives)."""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            return Decimal(str(value))
        except InvalidOperation:
            return None
    if is_null_token(value):
        return None

    text = str(value).strip()
    is_negative = text.startswith("(") and text.endswith(")")
    stripped = _CURRENCY_STRIP.sub("", text)
    if not stripped or stripped in {"-", ".", "-."}:
        return None

    try:
        amount = Decimal(stripped)
    except InvalidOperation:
        return None
    return -amount if is_negative and amount > 0 else amount


def parse_rating(value) -> tuple[int | None, bool]:
    """Parse the 1-5 satisfaction score.

    Returns:
        A ``(rating, was_out_of_range)`` pair. Values outside 1-5 are rejected
        rather than clamped, since a clamped score is silently wrong data.
    """
    if is_null_token(value):
        return None, False

    if isinstance(value, bool):
        return None, True
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        match = _FIRST_NUMBER.search(str(value))
        if not match:
            return None, True
        number = float(match.group())

    rating = int(round(number))
    if MIN_RATING <= rating <= MAX_RATING:
        return rating, False
    return None, True


def parse_duration_minutes(value) -> tuple[int | None, bool]:
    """Parse 'How long did the call take?' into whole minutes.

    Accepts Excel time/duration cells, bare numbers, ``"15 mins"``,
    ``"1 hour 30"``, and ``"0:15"``.

    Returns:
        A ``(minutes, was_unparseable)`` pair.
    """
    if is_null_token(value):
        return None, False

    if isinstance(value, timedelta):
        return int(round(value.total_seconds() / 60)), False
    if isinstance(value, time):
        return value.hour * _MINUTES_PER_HOUR + value.minute, False
    if isinstance(value, bool):
        return None, True
    if isinstance(value, (int, float)):
        return int(round(value)), False

    text = str(value).strip()
    clock = _CLOCK.match(text)
    if clock:
        return int(clock.group(1)) * _MINUTES_PER_HOUR + int(clock.group(2)), False

    hours = _HOURS.search(text)
    minutes = _MINUTES.search(text)
    if hours or minutes:
        total = 0.0
        if hours:
            total += float(hours.group(1)) * _MINUTES_PER_HOUR
        if minutes:
            total += float(minutes.group(1))
        return int(round(total)), False

    number = _FIRST_NUMBER.search(text)
    if number:
        return int(round(float(number.group()))), False
    return None, True


def truncate(text: str, max_length: int) -> str:
    """Trim text to a model field's limit (SQLite ignores it; Postgres will not)."""
    return text if len(text) <= max_length else text[:max_length]


def is_usable_site_id(value: str) -> bool:
    """True when a '#' cell looks like an identifier rather than a placeholder.

    Sub-location IDs such as ``24a`` and ``53b`` are legitimate and kept. A
    value with no digit at all (the tracker contains ``****`` on two unrelated
    rows) is a placeholder, and honouring it would merge distinct sites under
    one key.
    """
    return bool(value) and any(character.isdigit() for character in value)


def is_valid_rep_initials(value: str) -> bool:
    """True when an RS cell looks like a rep code rather than a stray note.

    The tracker has at least one row where a sentence was typed into the RS
    column; treating that as an assignment would create a junk RepAssignment.
    """
    return bool(_REP_INITIALS.match(value)) if value else False


def make_synthetic_site_id(name: str, address: str) -> str:
    """Derive a stable site_id for a row whose '#' column is blank.

    The hash is taken over the case- and whitespace-normalised site name and
    address, so the same row yields the same ID on every re-run and upserts
    stay idempotent. Addresses in the tracker contain embedded newlines, which
    are collapsed before hashing.

    Note that the ID is content-derived: editing a site's name or address in
    the sheet produces a different ID, which appears as a new Site rather than
    an update to the old one.
    """
    key = f"{' '.join(name.split()).lower()}|{' '.join(address.split()).lower()}"
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return f"{SYNTHETIC_ID_PREFIX}{digest[:SYNTHETIC_ID_HEX_LENGTH]}"
