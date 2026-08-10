"""Pure address-normalisation helpers for the Nominatim geocoding pass.

The tracker's address column is hand-typed and carries billing/delivery pairs,
parenthetical notes, and Compass-internal routing prefixes ("C/O EUREST BU
#23107 ..."). Nominatim's free-form search misses when a query leads with an
unrecognised company name, so addresses are cleaned before they are sent.

Two properties of OpenStreetMap's Canadian coverage shape the query strategy
here, both confirmed against the live service:

* Postal codes are sparse in OSM, so including one can *prevent* an otherwise
  good match ("609 4 AVE N COCHRANE AB, T4C 1Y5" misses; drop the postal code
  and it resolves correctly). Hence the postal-code-free retry.
* A postal-code-only query is worthless — every one of them matches the same
  unrelated POI in Cardston County, Alberta, because the literal word "Canada"
  appears in its name. Such queries are therefore never generated; the
  city/province locality is the last resort instead.

Every function here is side-effect free and returns a value rather than raising,
so a single malformed address degrades one query instead of failing a run.
"""
import re
import unicodedata

# Canadian postal code, with or without the interior space (K1V 0R4 / K1V0R4).
_POSTAL_CODE = re.compile(r"\b([A-Za-z]\d[A-Za-z])\s*(\d[A-Za-z]\d)\b")

# Compass routing noise: a business-unit number that is never part of the
# street address and reliably derails the geocoder.
_BUSINESS_UNIT = re.compile(r"\bBU\s*#?\s*\d+", re.I)

# Parenthetical annotations such as "(billing address)" or "(location)".
_PARENTHETICAL = re.compile(r"\([^)]*\)")

_CARE_OF_PREFIX = re.compile(r"^\s*c\s*/?\s*o\b", re.I)

# Province and territory codes as they appear in the tracker, mapped to the
# names Nominatim reports in its ``state`` field. Accents are stripped before
# comparison, so "Quebec" matches "Québec".
PROVINCE_NAMES = {
    "AB": "alberta",
    "BC": "british columbia",
    "MB": "manitoba",
    "NB": "new brunswick",
    "NL": "newfoundland and labrador",
    "NS": "nova scotia",
    "NT": "northwest territories",
    "NU": "nunavut",
    "ON": "ontario",
    "PE": "prince edward island",
    "QC": "quebec",
    "SK": "saskatchewan",
    "YT": "yukon",
}

_PROVINCE_TOKEN = re.compile(
    r"\b(" + "|".join(PROVINCE_NAMES) + r")\b(?=[,\s]|$)", re.I
)

# Street-type suffixes. Scanning an address backwards, the first of these marks
# the end of the street name and therefore the start of the city name.
_STREET_SUFFIXES = frozenset(
    """
    ST STREET AVE AVENUE RD ROAD DR DRIVE BLVD BOULEVARD CRES CRESCENT CRT
    COURT CT WAY PL PLACE LANE LN TRAIL TRL PKWY PARKWAY HWY HIGHWAY PVT CIR
    CIRCLE TERR TERRACE GATE GRV GROVE HTS HEIGHTS MEWS PROM SQ SQUARE BAY
    CLOSE LINK RISE VIEW WALK GDNS GARDENS GREEN PT POINT RUN ROW ESPLANADE
    CONCESSION SIDEROAD LINE LOOP PATH RIDGE COMMON CIRCUIT ALLEY
    """.split()
)

# Abbreviated compass directions that trail a street name ("4 AVE N"). Spelled
# out directions are deliberately excluded: "WEST" is far more often part of a
# city name ("WEST VANCOUVER", "NEW WESTMINSTER") than a street suffix.
_DIRECTIONALS = frozenset("N S E W NE NW SE SW".split())

# A city name longer than this is almost certainly a parsing failure.
_MAX_CITY_TOKENS = 4


def _strip_accents(value: str) -> str:
    """Return ``value`` with combining accent marks removed."""
    decomposed = unicodedata.normalize("NFD", value)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def collapse_whitespace(value: str) -> str:
    """Flatten newlines and runs of spaces into single spaces."""
    return " ".join(value.split())


def _is_province_token(token: str) -> bool:
    """True when ``token`` is a bare province code such as "SK" or "ON,"."""
    return token.strip(" ,;.").upper() in PROVINCE_NAMES


def _drop_care_of_prefix(text: str) -> str:
    """Remove a "C/O <company>" prefix, resuming at the street number.

    The street number is the first digit-leading token, but only one that falls
    *before* the province code — otherwise an address whose number is spelled
    out ("C/O CHARTWELLS ONE GEORGIAN DR BARRIE ON, L4M 3X9") would be cut back
    to a fragment of its postal code. When no such token exists, only the "C/O"
    marker itself is dropped and the company name is left for the geocoder to
    ignore.
    """
    tokens = text.split()
    if not tokens:
        return ""

    province_index = None
    for index, token in enumerate(tokens):
        if _is_province_token(token):
            province_index = index
    limit = province_index if province_index is not None else len(tokens)

    for index in range(1, limit):
        if tokens[index][0].isdigit():
            return " ".join(tokens[index:])

    return " ".join(tokens[1:])


def extract_postal_code(address: str) -> str:
    """Return the Canadian postal code in ``address``, or an empty string.

    The result is normalised to the canonical "A1A 1A1" form regardless of how
    it was typed.
    """
    match = _POSTAL_CODE.search(address or "")
    if not match:
        return ""
    return f"{match.group(1).upper()} {match.group(2).upper()}"


def extract_province(address: str) -> str:
    """Return the two-letter province code in ``address``, or an empty string.

    The *last* province token wins: a "C/O" prefix occasionally names another
    province before the real address begins.
    """
    matches = _PROVINCE_TOKEN.findall(address or "")
    return matches[-1].upper() if matches else ""


def matches_province(state: str, province_code: str) -> bool:
    """True when Nominatim's ``state`` agrees with the tracker's province code.

    Used to reject a confidently-wrong match. An unknown code or a missing
    ``state`` is treated as agreement, so the guard only ever rejects a
    positive contradiction rather than discarding usable results.
    """
    expected = PROVINCE_NAMES.get((province_code or "").upper())
    if not expected or not state:
        return True
    return _strip_accents(state).casefold().strip() == expected


def normalize_address(address: str) -> str:
    """Reduce a tracker address to the part Nominatim can actually resolve.

    Applies, in order: whitespace collapsing, selection of the first segment of
    a "billing | delivery" pair, removal of parenthetical notes and business-unit
    numbers, and — for rows that lead with "C/O <company>" — truncation back to
    the first street-number token.

    Returns an empty string when nothing usable remains.
    """
    if not address:
        return ""

    cleaned = collapse_whitespace(address)
    # A few rows pack two addresses into one cell separated by '|'; the first
    # is the one the sheet treats as primary.
    cleaned = cleaned.split("|")[0]
    cleaned = _PARENTHETICAL.sub(" ", cleaned)
    cleaned = _BUSINESS_UNIT.sub(" ", cleaned)
    cleaned = collapse_whitespace(cleaned)

    if _CARE_OF_PREFIX.match(cleaned):
        # "C/O EUREST 5770 AMBLER DR ..." -> "5770 AMBLER DR ...".
        cleaned = _drop_care_of_prefix(cleaned)

    return collapse_whitespace(cleaned.strip(" ,;-"))


def strip_postal_code(address: str) -> str:
    """Return ``address`` with any postal code removed."""
    return collapse_whitespace(_POSTAL_CODE.sub(" ", address or "")).strip(" ,;-")


def extract_locality(address: str) -> str:
    """Return "CITY, PROV, Canada" for ``address``, or an empty string.

    The city is recovered by scanning backwards from the province token and
    collecting words until a street suffix, an abbreviated compass direction, or
    a number is reached. This is city-level precision only — it exists as the
    last resort before a site is reported as a failure, and it keeps the site in
    the correct town rather than dropping it.
    """
    province = extract_province(address)
    if not province:
        return ""

    head = strip_postal_code(normalize_address(address))
    tokens = [token.strip(" ,;.") for token in head.split()]
    tokens = [token for token in tokens if token]

    # Trim everything from the province token onwards.
    for index in range(len(tokens) - 1, -1, -1):
        if tokens[index].upper() == province:
            tokens = tokens[:index]
            break
    else:
        return ""

    city_parts: list[str] = []
    for token in reversed(tokens):
        upper = token.upper()
        if upper in _STREET_SUFFIXES or upper in _DIRECTIONALS:
            break
        if any(character.isdigit() for character in token):
            break
        city_parts.append(token)
        if len(city_parts) == _MAX_CITY_TOKENS:
            break

    if not city_parts:
        return ""

    city = " ".join(reversed(city_parts))
    return f"{city}, {province}, Canada"


def build_query_variants(address: str) -> tuple[str, ...]:
    """Return the ordered, de-duplicated queries to try for one address.

    Ordered most to least precise:

    1. the cleaned street address as written,
    2. the same address with the postal code removed, since a postal code OSM
       does not know can suppress an otherwise good street-level match,
    3. the "CITY, PROV, Canada" locality, as a coarse but correctly-placed
       fallback.
    """
    variants: list[str] = []

    normalized = normalize_address(address)
    if normalized:
        variants.append(normalized)

        without_postal = strip_postal_code(normalized)
        if without_postal:
            variants.append(without_postal)

    locality = extract_locality(address)
    if locality:
        variants.append(locality)

    # dict.fromkeys preserves order while dropping duplicates.
    return tuple(dict.fromkeys(variants))
