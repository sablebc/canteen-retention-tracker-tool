"""Accepting a tracker export over HTTP and handing it to the ingest command.

Kept out of ``views.py`` so the upload rules (what counts as a valid export,
where it lands on disk) stay readable next to each other and testable without
going through the view.
"""
import json
import re
from io import StringIO
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

ALLOWED_SUFFIX = ".xlsx"

# Filenames are rebuilt from scratch rather than trusted: only these characters
# survive from the upload, which rules out path traversal and shell surprises.
_UNSAFE_CHARACTERS = re.compile(r"[^A-Za-z0-9._-]+")
_MAX_STEM_LENGTH = 60


class ImportError_(Exception):
    """A rejected upload, carrying the message to show the user."""


def _safe_stem(filename: str) -> str:
    """Reduce an uploaded filename to a safe, recognisable stem."""
    stem = Path(filename or "").name
    stem = stem[: -len(ALLOWED_SUFFIX)] if stem.lower().endswith(ALLOWED_SUFFIX) else stem
    stem = _UNSAFE_CHARACTERS.sub("-", stem).strip("-.")
    return (stem or "tracker")[:_MAX_STEM_LENGTH]


def validate_upload(uploaded) -> None:
    """Reject anything that is not a plausibly-sized .xlsx.

    Raises:
        ImportError_: With a user-facing explanation.
    """
    if uploaded is None:
        raise ImportError_("Attach the tracker .xlsx export as 'file'.")

    name = Path(uploaded.name or "").name
    if not name.lower().endswith(ALLOWED_SUFFIX):
        raise ImportError_(
            f"Expected a {ALLOWED_SUFFIX} export, got '{name}'."
        )

    if uploaded.size == 0:
        raise ImportError_("The uploaded file is empty.")

    limit = settings.TRACKER_UPLOAD_MAX_BYTES
    if uploaded.size > limit:
        raise ImportError_(
            f"File is {uploaded.size} bytes; the limit is {limit}."
        )


def store_upload(uploaded) -> Path:
    """Write the upload into the tracker directory under a timestamped name.

    Timestamping keeps every export that has been imported, so a bad refresh
    can be diagnosed against the exact file that produced it.
    """
    directory = Path(settings.TRACKER_UPLOAD_DIR)
    directory.mkdir(parents=True, exist_ok=True)

    stamp = timezone.localtime().strftime("%Y%m%d-%H%M%S")
    destination = directory / f"{_safe_stem(uploaded.name)}_{stamp}{ALLOWED_SUFFIX}"

    with destination.open("wb") as handle:
        for chunk in uploaded.chunks():
            handle.write(chunk)

    return destination


def run_ingest(path: Path) -> dict:
    """Run the ingest command over ``path`` and return its summary.

    Uses the management command rather than reimplementing the load, so the
    upload path and a manual ``manage.py ingest_tracker`` run stay identical.

    Raises:
        ImportError_: If the command rejects the workbook.
    """
    buffer = StringIO()
    try:
        call_command("ingest_tracker", str(path), json_summary=True, stdout=buffer)
    except CommandError as exc:
        raise ImportError_(str(exc)) from exc

    try:
        return json.loads(buffer.getvalue())
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive
        raise ImportError_(
            "The ingest command did not return a readable summary."
        ) from exc


def describe(summary: dict) -> str:
    """One-line result sentence for the UI's confirmation modal."""
    created = summary.get("sites_created", 0)
    updated = summary.get("sites_updated", 0)
    warnings = summary.get("warning_count", 0)
    return (
        f"Updated {updated} sites, created {created} new sites, "
        f"{warnings} warnings"
    )
