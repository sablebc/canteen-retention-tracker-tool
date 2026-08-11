"""Tests for the deployment checks.

The case that matters most is `CorsMatchesHostsTests`: an origin allowed by
CORS whose host is missing from ALLOWED_HOSTS is the exact shape of the
misconfiguration that returns 400 with no CORS headers, which the browser then
reports as an unexplained "NetworkError". Nothing in the running app surfaces
it, so it has to be caught here.
"""
from pathlib import Path
from tempfile import TemporaryDirectory

from django.test import SimpleTestCase

from retention.deploy_checks import (
    FAIL,
    OK,
    WARN,
    check_allowed_hosts,
    check_cors_matches_allowed_hosts,
    check_cors_origins,
    check_debug,
    check_geocoding,
    check_public_origin,
    check_secret_key,
    check_seeded,
    check_upload_dir,
)


class DebugTests(SimpleTestCase):
    def test_warns_when_debug_is_on(self):
        self.assertEqual(check_debug(True).status, WARN)

    def test_passes_when_debug_is_off(self):
        self.assertEqual(check_debug(False).status, OK)


class SecretKeyTests(SimpleTestCase):
    def test_fails_on_the_insecure_default(self):
        result = check_secret_key("django-insecure-dev-only-change-me-before-production")
        self.assertEqual(result.status, FAIL)

    def test_fails_on_a_short_key(self):
        self.assertEqual(check_secret_key("short").status, FAIL)

    def test_passes_on_a_real_key(self):
        self.assertEqual(check_secret_key("x" * 60).status, OK)


class AllowedHostsTests(SimpleTestCase):
    def test_warns_when_only_localhost_is_allowed(self):
        result = check_allowed_hosts(["localhost", "127.0.0.1"])
        self.assertEqual(result.status, WARN)

    def test_passes_with_a_routable_address(self):
        result = check_allowed_hosts(["192.168.2.17", "localhost"])
        self.assertEqual(result.status, OK)

    def test_warns_on_the_wildcard(self):
        self.assertEqual(check_allowed_hosts(["*"]).status, WARN)

    def test_fails_when_empty(self):
        self.assertEqual(check_allowed_hosts([]).status, FAIL)


class CorsOriginsTests(SimpleTestCase):
    def test_fails_when_empty(self):
        self.assertEqual(check_cors_origins([]).status, FAIL)

    def test_fails_when_an_origin_has_no_scheme(self):
        result = check_cors_origins(["192.168.2.17:5173"])
        self.assertEqual(result.status, FAIL)

    def test_fails_when_an_origin_carries_a_path(self):
        result = check_cors_origins(["http://192.168.2.17:5173/app"])
        self.assertEqual(result.status, FAIL)

    def test_passes_on_well_formed_origins(self):
        result = check_cors_origins(
            ["http://192.168.2.17:5173", "http://localhost:5173"]
        )
        self.assertEqual(result.status, OK)


class CorsMatchesHostsTests(SimpleTestCase):
    def test_fails_when_an_origin_host_is_absent_from_allowed_hosts(self):
        result = check_cors_matches_allowed_hosts(
            ["http://192.168.2.17:5173"], ["localhost", "127.0.0.1"]
        )
        self.assertEqual(result.status, FAIL)
        self.assertIn("192.168.2.17", result.message)

    def test_passes_when_every_origin_host_is_allowed(self):
        result = check_cors_matches_allowed_hosts(
            ["http://192.168.2.17:5173", "http://localhost:5173"],
            ["192.168.2.17", "localhost"],
        )
        self.assertEqual(result.status, OK)

    def test_passes_when_allowed_hosts_is_wildcarded(self):
        result = check_cors_matches_allowed_hosts(["http://anything:5173"], ["*"])
        self.assertEqual(result.status, OK)


class PublicOriginTests(SimpleTestCase):
    def test_fails_when_the_proxy_host_is_not_allowed(self):
        # The proxy forwards the browser's Host, so an unlisted one is a 400
        # for every request that arrives through it.
        result = check_public_origin("http://canteen.lan", ["localhost"])
        self.assertEqual(result.status, FAIL)
        self.assertIn("canteen.lan", result.message)

    def test_passes_when_the_proxy_host_is_allowed(self):
        result = check_public_origin("http://canteen.lan", ["canteen.lan", "localhost"])
        self.assertEqual(result.status, OK)

    def test_reports_direct_serving_when_unset(self):
        result = check_public_origin("", ["localhost"])
        self.assertEqual(result.status, OK)
        self.assertIn("No reverse proxy", result.message)


class CorsWhenSameOriginTests(SimpleTestCase):
    def test_empty_cors_is_fine_behind_a_proxy(self):
        # Same-origin requests never consult CORS, so nothing to allow.
        self.assertEqual(check_cors_origins([], same_origin=True).status, OK)

    def test_empty_cors_still_fails_when_serving_two_origins(self):
        self.assertEqual(check_cors_origins([], same_origin=False).status, FAIL)


class SeededTests(SimpleTestCase):
    def test_warns_when_no_sites_have_been_imported(self):
        result = check_seeded(0)
        self.assertEqual(result.status, WARN)
        self.assertIn("ingest_tracker", result.message)

    def test_passes_once_sites_exist(self):
        self.assertEqual(check_seeded(905).status, OK)


class GeocodingTests(SimpleTestCase):
    def test_warns_when_nothing_is_geocoded(self):
        self.assertEqual(check_geocoding(905, 0).status, WARN)

    def test_warns_when_coverage_is_partial(self):
        self.assertEqual(check_geocoding(905, 40).status, WARN)

    def test_passes_when_fully_geocoded(self):
        self.assertEqual(check_geocoding(905, 905).status, OK)

    def test_passes_when_there_is_nothing_to_geocode(self):
        self.assertEqual(check_geocoding(0, 0).status, OK)


class UploadDirTests(SimpleTestCase):
    def test_passes_for_a_writable_directory(self):
        with TemporaryDirectory() as directory:
            self.assertEqual(check_upload_dir(Path(directory)).status, OK)

    def test_fails_when_the_path_cannot_be_created(self):
        # A path under a regular file can never be made into a directory.
        with TemporaryDirectory() as directory:
            blocker = Path(directory) / "a-file"
            blocker.write_text("not a directory")
            self.assertEqual(check_upload_dir(blocker / "uploads").status, FAIL)
