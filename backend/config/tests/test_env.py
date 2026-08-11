"""Tests for the environment parsing behind the network settings.

These cover the mistakes that actually get made when deploying to a LAN box,
because every one of them surfaces in the browser as the same opaque
"NetworkError" with nothing to distinguish it: a stray space after a comma, a
scheme pasted into a host list, a port left on a hostname.
"""
from django.test import SimpleTestCase

from config.env import build_origins, parse_hosts, split_env


class SplitEnvTests(SimpleTestCase):
    def test_splits_a_comma_separated_list(self):
        self.assertEqual(split_env("a,b,c"), ["a", "b", "c"])

    def test_strips_whitespace_around_each_entry(self):
        self.assertEqual(split_env("a, b ,  c"), ["a", "b", "c"])

    def test_drops_empty_entries_from_a_trailing_comma(self):
        self.assertEqual(split_env("a,b,"), ["a", "b"])

    def test_returns_empty_list_for_a_blank_value(self):
        self.assertEqual(split_env(""), [])
        self.assertEqual(split_env("   "), [])

    def test_returns_empty_list_for_none(self):
        self.assertEqual(split_env(None), [])


class ParseHostsTests(SimpleTestCase):
    def test_keeps_a_plain_hostname(self):
        self.assertEqual(parse_hosts("192.168.2.17"), ["192.168.2.17"])

    def test_strips_a_scheme_that_was_pasted_in(self):
        # ALLOWED_HOSTS takes bare hosts; a pasted URL silently matches nothing.
        self.assertEqual(parse_hosts("http://192.168.2.17"), ["192.168.2.17"])
        self.assertEqual(parse_hosts("https://example.local"), ["example.local"])

    def test_strips_a_port_that_was_pasted_in(self):
        self.assertEqual(parse_hosts("192.168.2.17:8001"), ["192.168.2.17"])

    def test_strips_a_scheme_and_a_port_together(self):
        self.assertEqual(parse_hosts("http://192.168.2.17:5173"), ["192.168.2.17"])

    def test_strips_a_trailing_slash(self):
        self.assertEqual(parse_hosts("http://192.168.2.17/"), ["192.168.2.17"])

    def test_preserves_the_wildcard(self):
        self.assertEqual(parse_hosts("*"), ["*"])

    def test_deduplicates_while_preserving_order(self):
        self.assertEqual(
            parse_hosts("localhost,127.0.0.1,localhost"),
            ["localhost", "127.0.0.1"],
        )

    def test_handles_a_realistic_messy_value(self):
        self.assertEqual(
            parse_hosts(" http://192.168.2.17:8001 , localhost,"),
            ["192.168.2.17", "localhost"],
        )


class BuildOriginsTests(SimpleTestCase):
    def test_pairs_each_host_with_the_port(self):
        self.assertEqual(
            build_origins(["192.168.2.17", "localhost"], "5173"),
            ["http://192.168.2.17:5173", "http://localhost:5173"],
        )

    def test_skips_the_wildcard_because_cors_rejects_it(self):
        # ALLOWED_HOSTS accepts '*'; CORS_ALLOWED_ORIGINS does not, and a
        # literal "http://*:5173" would match no browser origin at all.
        self.assertEqual(
            build_origins(["*", "192.168.2.17"], "5173"),
            ["http://192.168.2.17:5173"],
        )

    def test_deduplicates_while_preserving_order(self):
        self.assertEqual(
            build_origins(["localhost", "localhost"], "5173"),
            ["http://localhost:5173"],
        )

    def test_returns_empty_for_no_hosts(self):
        self.assertEqual(build_origins([], "5173"), [])

    def test_omits_the_port_when_it_is_the_http_default(self):
        # "http://host:80" is not the origin a browser sends; it sends
        # "http://host", so a listed :80 origin would never match.
        self.assertEqual(build_origins(["example.local"], "80"), ["http://example.local"])
