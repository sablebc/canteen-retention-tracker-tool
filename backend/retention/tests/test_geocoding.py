"""Tests for the pure address helpers behind the Nominatim geocoding pass.

These run without a database: every function under test is side-effect free.
The cases are drawn from real tracker rows, because the parsing rules exist to
handle specific shapes the hand-maintained sheet actually contains.
"""
from django.test import SimpleTestCase

from retention.geocoding import (
    build_query_variants,
    extract_locality,
    extract_postal_code,
    extract_province,
    matches_province,
    normalize_address,
    strip_postal_code,
)


class NormalizeAddressTests(SimpleTestCase):
    def test_returns_empty_string_for_blank_address(self):
        self.assertEqual(normalize_address(""), "")

    def test_leaves_a_clean_address_untouched(self):
        address = "609 4 AVE N COCHRANE AB, T4C 1Y5"
        self.assertEqual(normalize_address(address), address)

    def test_collapses_newlines_and_repeated_spaces(self):
        self.assertEqual(
            normalize_address("123  MAIN ST\nCALGARY AB"), "123 MAIN ST CALGARY AB"
        )

    def test_keeps_only_the_first_of_a_billing_delivery_pair(self):
        address = (
            "20 COPE DR KANATA ON, K2M 2V8 (billing address) | "
            "140 THAD JOHNSON PVT OTTAWA ON, K1V 0R4 (delivery point address)"
        )
        self.assertEqual(normalize_address(address), "20 COPE DR KANATA ON, K2M 2V8")

    def test_drops_care_of_company_and_business_unit_number(self):
        address = "C/O EUREST BU #23107 5770 AMBLER DR MISSISSAUGA ON L4W 2T3"
        self.assertEqual(
            normalize_address(address), "5770 AMBLER DR MISSISSAUGA ON L4W 2T3"
        )

    def test_keeps_street_number_that_precedes_an_ordinal_street_name(self):
        # Regression: an earlier rule matched only one trailing letter, so it
        # could not see the "3RD" in "222 3RD AVE" and discarded the address.
        address = "C/O EUREST BU #53505 222 3RD AVE N SASKATOON SK, S7K 0J5"
        self.assertEqual(
            normalize_address(address), "222 3RD AVE N SASKATOON SK, S7K 0J5"
        )

    def test_keeps_company_when_street_number_is_spelled_out(self):
        # "ONE GEORGIAN DR" has no digit before the province, so truncating to
        # the first digit-leading token would cut into the postal code.
        address = "C/O CHARTWELLS BU #17611 ONE GEORGIAN DR BARRIE ON, L4M 3X9"
        self.assertEqual(
            normalize_address(address), "CHARTWELLS ONE GEORGIAN DR BARRIE ON, L4M 3X9"
        )


class PostalCodeTests(SimpleTestCase):
    def test_extracts_and_canonicalises_a_postal_code(self):
        self.assertEqual(extract_postal_code("... ON, k1v0r4"), "K1V 0R4")

    def test_returns_empty_string_when_absent(self):
        self.assertEqual(extract_postal_code("123 MAIN ST CALGARY AB"), "")

    def test_strip_removes_the_postal_code(self):
        self.assertEqual(
            strip_postal_code("609 4 AVE N COCHRANE AB, T4C 1Y5"),
            "609 4 AVE N COCHRANE AB",
        )


class ProvinceTests(SimpleTestCase):
    def test_extracts_the_province_code(self):
        self.assertEqual(extract_province("609 4 AVE N COCHRANE AB, T4C 1Y5"), "AB")

    def test_last_province_wins_over_a_care_of_prefix(self):
        address = "C/O HEAD OFFICE ON 123 MAIN ST VANCOUVER BC, V6E 2E9"
        self.assertEqual(extract_province(address), "BC")

    def test_returns_empty_string_when_absent(self):
        self.assertEqual(extract_province("123 MAIN ST"), "")

    def test_matches_province_accepts_the_expected_state(self):
        self.assertTrue(matches_province("Alberta", "AB"))

    def test_matches_province_ignores_accents(self):
        self.assertTrue(matches_province("Québec", "QC"))

    def test_matches_province_rejects_a_contradiction(self):
        self.assertFalse(matches_province("Alberta", "BC"))

    def test_matches_province_defers_when_information_is_missing(self):
        self.assertTrue(matches_province("", "AB"))
        self.assertTrue(matches_province("Alberta", ""))


class LocalityTests(SimpleTestCase):
    def test_recovers_a_single_word_city(self):
        self.assertEqual(
            extract_locality("609 4 AVE N COCHRANE AB, T4C 1Y5"),
            "COCHRANE, AB, Canada",
        )

    def test_recovers_a_multi_word_city(self):
        self.assertEqual(
            extract_locality("2345 10 AVE W PRINCE ALBERT SK, S6V 7V6"),
            "PRINCE ALBERT, SK, Canada",
        )

    def test_keeps_a_spelled_out_direction_that_belongs_to_the_city(self):
        self.assertEqual(
            extract_locality("101 BRIDGE RD WEST VANCOUVER BC, V7P 3R2"),
            "WEST VANCOUVER, BC, Canada",
        )

    def test_stops_at_an_abbreviated_direction(self):
        self.assertEqual(
            extract_locality("1154 KENSINGTON CRES NW CALGARY AB, T2N 1X6"),
            "CALGARY, AB, Canada",
        )

    def test_returns_empty_string_without_a_province(self):
        self.assertEqual(extract_locality("123 MAIN ST"), "")


class QueryVariantTests(SimpleTestCase):
    def test_blank_address_yields_no_queries(self):
        self.assertEqual(build_query_variants(""), ())

    def test_orders_variants_from_precise_to_coarse(self):
        self.assertEqual(
            build_query_variants("609 4 AVE N COCHRANE AB, T4C 1Y5"),
            (
                "609 4 AVE N COCHRANE AB, T4C 1Y5",
                "609 4 AVE N COCHRANE AB",
                "COCHRANE, AB, Canada",
            ),
        )

    def test_never_emits_a_postal_code_only_query(self):
        # Every postal-code-only query matches the same unrelated POI in
        # Cardston County, so such a query must never be generated.
        for variant in build_query_variants("609 4 AVE N COCHRANE AB, T4C 1Y5"):
            self.assertNotEqual(variant, "T4C 1Y5, Canada")

    def test_deduplicates_when_there_is_no_postal_code(self):
        variants = build_query_variants("123 MAIN ST CALGARY AB")
        self.assertEqual(len(variants), len(set(variants)))
        self.assertEqual(variants[0], "123 MAIN ST CALGARY AB")
