"""Tests for the retention API's read and write endpoints."""
from datetime import date

from django.test import TestCase
from django.utils import timezone

from retention.models import CallRecord, RepAssignment, RevenueSnapshot, Site

SITES_URL = "/api/retention/sites/"
CALLS_URL = "/api/retention/calls/"


class SitePatchTests(TestCase):
    def setUp(self):
        self.site = Site.objects.create(
            site_id="1",
            name="Test Site",
            address="123 Main St",
            branch="VAN",
            lob="OCS",
            phone_number="604-555-0100",
            contact_name="Old Contact",
            method_of_ordering="Phone",
            account_status="Active",
        )

    def test_patch_updates_the_editable_fields(self):
        response = self.client.patch(
            f"{SITES_URL}{self.site.pk}/",
            data={"contact_name": "New Contact", "lob": "Vending"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.site.refresh_from_db()
        self.assertEqual(self.site.contact_name, "New Contact")
        self.assertEqual(self.site.lob, "Vending")

    def test_patch_responds_in_the_list_serializer_shape(self):
        RepAssignment.objects.create(site=self.site, rep_initials="BC")
        RevenueSnapshot.objects.create(
            site=self.site,
            snapshot_date=date(2026, 8, 10),
            annual_revenue="1000.00",
        )

        response = self.client.patch(
            f"{SITES_URL}{self.site.pk}/",
            data={"phone_number": "604-555-0199"},
            content_type="application/json",
        )

        body = response.json()
        self.assertEqual(body["phone_number"], "604-555-0199")
        # Fields the update serializer does not carry must still come back.
        self.assertEqual(body["site_id"], "1")
        self.assertEqual(body["name"], "Test Site")
        self.assertEqual(body["rep_assignment"], {"id": 1, "rep_initials": "BC"})
        self.assertEqual(len(body["revenue_snapshots"]), 1)

    def test_patch_rejects_a_field_that_is_not_editable(self):
        response = self.client.patch(
            f"{SITES_URL}{self.site.pk}/",
            data={"name": "Renamed", "account_status": "Inactive"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("name", response.json())
        self.assertIn("account_status", response.json())

        self.site.refresh_from_db()
        self.assertEqual(self.site.name, "Test Site")

    def test_patch_rejects_an_unknown_field_alongside_a_valid_one(self):
        response = self.client.patch(
            f"{SITES_URL}{self.site.pk}/",
            data={"lob": "Market", "latitude": 49.2},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.site.refresh_from_db()
        # The whole request is rejected; the valid half must not be applied.
        self.assertEqual(self.site.lob, "OCS")

    def test_put_is_not_allowed(self):
        response = self.client.put(
            f"{SITES_URL}{self.site.pk}/",
            data={"lob": "Market"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 405)

    def test_delete_is_not_allowed(self):
        response = self.client.delete(f"{SITES_URL}{self.site.pk}/")
        self.assertEqual(response.status_code, 405)


class CallRecordCreateTests(TestCase):
    def setUp(self):
        self.site = Site.objects.create(site_id="1", name="Test Site")

    def test_creates_a_call_with_the_minimum_payload(self):
        response = self.client.post(
            CALLS_URL,
            data={"site": self.site.pk, "rep_initials": "BC"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        call = CallRecord.objects.get()
        self.assertEqual(call.rep_initials, "BC")
        self.assertEqual(call.site, self.site)

    def test_call_date_defaults_to_today_when_omitted(self):
        response = self.client.post(
            CALLS_URL,
            data={"site": self.site.pk, "rep_initials": "BC"},
            content_type="application/json",
        )

        self.assertEqual(response.json()["call_date"], str(timezone.localdate()))

    def test_an_explicit_call_date_is_kept(self):
        response = self.client.post(
            CALLS_URL,
            data={
                "site": self.site.pk,
                "rep_initials": "BC",
                "call_date": "2026-01-15",
            },
            content_type="application/json",
        )

        self.assertEqual(response.json()["call_date"], "2026-01-15")

    def test_stores_every_optional_field(self):
        response = self.client.post(
            CALLS_URL,
            data={
                "site": self.site.pk,
                "rep_initials": "CM",
                "duration_minutes": 12,
                "q1_last_order_feedback": "Went well",
                "q2_working_well": "Delivery",
                "rating": 4,
                "q4_could_improve": "More variety",
                "notes": "Long chat",
                "actions_required": "Send catalogue",
                "data_corrections": "Phone number changed",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        call = CallRecord.objects.get()
        self.assertEqual(call.duration_minutes, 12)
        self.assertEqual(call.rating, 4)
        self.assertEqual(call.data_corrections, "Phone number changed")

    def test_rep_initials_is_required(self):
        response = self.client.post(
            CALLS_URL,
            data={"site": self.site.pk},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("rep_initials", response.json())

    def test_site_is_required(self):
        response = self.client.post(
            CALLS_URL,
            data={"rep_initials": "BC"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("site", response.json())

    def test_rating_above_five_is_rejected(self):
        response = self.client.post(
            CALLS_URL,
            data={"site": self.site.pk, "rep_initials": "BC", "rating": 6},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("rating", response.json())
        self.assertEqual(CallRecord.objects.count(), 0)

    def test_rating_below_one_is_rejected(self):
        response = self.client.post(
            CALLS_URL,
            data={"site": self.site.pk, "rep_initials": "BC", "rating": 0},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("rating", response.json())


class CallRecordListTests(TestCase):
    def setUp(self):
        self.site = Site.objects.create(site_id="1", name="Site One")
        self.other = Site.objects.create(site_id="2", name="Site Two")

        self.older = CallRecord.objects.create(
            site=self.site, rep_initials="BC", call_date=date(2026, 1, 1)
        )
        self.newer = CallRecord.objects.create(
            site=self.site, rep_initials="BC", call_date=date(2026, 6, 1)
        )
        self.elsewhere = CallRecord.objects.create(
            site=self.other, rep_initials="CM", call_date=date(2026, 3, 1)
        )

    def test_filters_to_the_requested_site(self):
        response = self.client.get(CALLS_URL, {"site": self.site.pk})

        self.assertEqual(response.status_code, 200)
        returned = [row["id"] for row in response.json()]
        self.assertEqual(returned, [self.newer.pk, self.older.pk])

    def test_orders_by_call_date_descending(self):
        response = self.client.get(CALLS_URL, {"site": self.site.pk})

        dates = [row["call_date"] for row in response.json()]
        self.assertEqual(dates, sorted(dates, reverse=True))

    def test_unfiltered_list_returns_every_call(self):
        response = self.client.get(CALLS_URL)
        self.assertEqual(len(response.json()), 3)

    def test_rejects_a_non_numeric_site_filter(self):
        response = self.client.get(CALLS_URL, {"site": "not-a-pk"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("site", response.json())

    def test_undated_calls_sort_after_dated_ones(self):
        # Every row the tracker import creates has a null call_date.
        undated = CallRecord.objects.create(
            site=self.site, rep_initials="BC", call_date=None
        )

        response = self.client.get(CALLS_URL, {"site": self.site.pk})
        returned = [row["id"] for row in response.json()]

        self.assertEqual(returned[-1], undated.pk)
