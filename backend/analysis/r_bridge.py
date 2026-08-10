"""Bridge for invoking R analysis scripts from Django.

The convention is that each R script performs its computation and prints a
single JSON object as the last line of stdout. This module shells out to
``Rscript``, captures that line, parses it, and returns the resulting dict.
"""
import json
import subprocess
from pathlib import Path

from django.conf import settings

DEFAULT_TIMEOUT_SECONDS = 60


class RScriptError(RuntimeError):
    """Raised when an R script fails to run or returns unusable output."""


def run_r_script(script_name, args=None, timeout=DEFAULT_TIMEOUT_SECONDS):
    """Run an R script and return the JSON object it prints as its last line.

    Args:
        script_name: File name of the script within ``settings.R_SCRIPTS_DIR``.
        args: Optional iterable of string arguments passed to the script.
        timeout: Maximum seconds to wait before aborting the subprocess.

    Returns:
        The parsed JSON object (typically a dict) from the script's final
        stdout line.

    Raises:
        RScriptError: If the script is missing, exits non-zero, times out, or
            does not emit parseable JSON as its last stdout line.
    """
    scripts_dir = Path(settings.R_SCRIPTS_DIR)
    script_path = scripts_dir / script_name

    if not script_path.is_file():
        raise RScriptError(f"R script not found: {script_path}")

    command = ["Rscript", str(script_path)]
    if args:
        command.extend(str(arg) for arg in args)

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError as exc:
        raise RScriptError(
            "Rscript executable not found; is R installed and on PATH?"
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise RScriptError(
            f"R script '{script_name}' timed out after {timeout}s"
        ) from exc

    if completed.returncode != 0:
        raise RScriptError(
            f"R script '{script_name}' exited with code "
            f"{completed.returncode}: {completed.stderr.strip()}"
        )

    lines = [line for line in completed.stdout.splitlines() if line.strip()]
    if not lines:
        raise RScriptError(
            f"R script '{script_name}' produced no output on stdout"
        )

    last_line = lines[-1]
    try:
        return json.loads(last_line)
    except json.JSONDecodeError as exc:
        raise RScriptError(
            f"R script '{script_name}' did not emit valid JSON as its last "
            f"line: {last_line!r}"
        ) from exc
