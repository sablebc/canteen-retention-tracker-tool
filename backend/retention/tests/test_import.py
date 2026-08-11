"""Tests for the call-outcome field and the tracker re-import endpoint."""
import shutil
import tempfile
from datetime import date
from io import BytesIO
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from openpyxl import Workbook

from retention.models import (
    CallOutcome,
    CallRecord,
    ContactMethod,
    ImportLog,
    RepAssignment,
    Site,
)

SITES_URL = "/api/retention/sites/"
IMPORT_URL = "/api/retention/import/"
IMPORT_LOG_URL = "/api/retention/imports/"

# Mirrors the real export: headers on row 1, a legend block, data from row 12.
HEADERS = [
    "RS", "#", "Site Name", "Address", "Method of ordering", "Contact Name ",
    "Branch", "f25", "Annual Revenue", "LOB", "Phone Number", "Account Status",
    "Last Order Date", "Q1. How was your last order?", "Q2. Working well?",
    "Q3. Rating", "Q.4 Anything better?", "How Long did the call take ?",
    "Notes from Call", "Actions required ",
]
DATA_START_ROW = 12


def build_workbook(rows):
    """Build an in-memory .xlsx shaped like the real tracker export."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Retention Tracker"

    sheet.append(HEADERS)
    # Legend/preamble rows 2-11, which the parser skips.
    for _ in range(DATA_START_ROW - 2):
        sheet.append([])
    for row in rows:
        sheet.append(row)

    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def site_row(site_id, name, *, rep="BC", branch="VAN", status="Active",
             address="1 Main St Vancouver BC, V1V 1V1"):
    row = [None] * len(HEADERS)
    row[0] = rep
    row[1] = site_id
    row[2] = name
    row[3] = address
    row[6] = branch
    row[7] = 1000
    row[8] = 2000
    row[11] = status
    return row


def upload(content, filename="tracker.xlsx"):
    return SimpleUploadedFile(
        filename,
        content,
        content_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
    )


class CallOutcomeFieldTests(TestCase):
    def setUp(self):
        self.site = Site.objects.create(site_id="1", name="Test Site")

    def test_defaults_to_blank(self):
        self.assertEqual(self.site.call_outcome, "")

    def test_patch_sets_the_outcome(self):
        response = self.client.patch(
            f"{SITES_URL}{self.site.pk}/",
            data={"call_outcome": CallOutcome.COMPLETED_SURVEY},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.site.refresh_from_db()
        self.assertEqual(self.site.call_outcome, "completed_survey")

    def test_patch_response_carries_the_outcome(self):
        response = self.client.patch(
            f"{SITES_URL}{self.site.pk}/",
            data={"call_outcome": CallOutcome.LEFT_VM},
            content_type="application/json",
        )
        self.assertEqual(response.json()["call_outcome"], "left_vm")

    def test_patch_rejects_an_outcome_outside_the_legend(self):
        response = self.client.patch(
            f"{SITES_URL}{self.site.pk}/",
            data={"call_outcome": "made_up"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("call_outcome", response.json())
        self.site.refresh_from_db()
        self.assertEqual(self.site.call_outcome, "")

    def test_the_outcome_can_be_cleared(self):
        self.site.call_outcome = CallOutcome.FOLLOW_UP
        self.site.save(update_fields=["call_outcome"])

        response = self.client.patch(
            f"{SITES_URL}{self.site.pk}/",
            data={"call_outcome": ""},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.site.refresh_from_db()
        self.assertEqual(self.site.call_outcome, "")

    def test_the_list_endpoint_exposes_the_outcome(self):
        self.site.call_outcome = CallOutcome.FRENCH_ACCOUNT
        self.site.save(update_fields=["call_outcome"])

        body = self.client.get(SITES_URL).json()
        self.assertEqual(body[0]["call_outcome"], "french_account")


class ContactMethodFieldTests(TestCase):
    """The preferred way to reach a contact, owned by this tool.

    Deliberately separate from ``method_of_ordering``, which the tracker owns
    and the ingest overwrites.
    """

    def setUp(self):
        self.site = Site.objects.create(site_id="1", name="Test Site")

    def test_defaults_to_blank(self):
        self.assertEqual(self.site.contact_method, "")

    def test_patch_sets_the_method(self):
        response = self.client.patch(
            f"{SITES_URL}{self.site.pk}/",
            data={"contact_method": ContactMethod.EMAIL},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.site.refresh_from_db()
        self.assertEqual(self.site.contact_method, "email")

    def test_patch_response_carries_the_method(self):
        response = self.client.patch(
            f"{SITES_URL}{self.site.pk}/",
            data={"contact_method": ContactMethod.IN_PERSON},
            content_type="application/json",
        )
        self.assertEqual(response.json()["contact_method"], "in_person")

    def test_patch_rejects_an_unknown_method(self):
        response = self.client.patch(
            f"{SITES_URL}{self.site.pk}/",
            data={"contact_method": "carrier_pigeon"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("contact_method", response.json())
        self.site.refresh_from_db()
        self.assertEqual(self.site.contact_method, "")

    def test_the_method_can_be_cleared(self):
        self.site.contact_method = ContactMethod.PHONE
        self.site.save(update_fields=["contact_method"])

        response = self.client.patch(
            f"{SITES_URL}{self.site.pk}/",
            data={"contact_method": ""},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.site.refresh_from_db()
        self.assertEqual(self.site.contact_method, "")

    def test_the_list_endpoint_exposes_the_method(self):
        self.site.contact_method = ContactMethod.TEXT
        self.site.save(update_fields=["contact_method"])

        body = self.client.get(SITES_URL).json()
        self.assertEqual(body[0]["contact_method"], "text")

    def test_it_is_independent_of_method_of_ordering(self):
        # The tracker owns one and this tool owns the other; setting the
        # tool-owned one must not disturb the tracker's value.
        self.site.method_of_ordering = "Online portal"
        self.site.save(update_fields=["method_of_ordering"])

        self.client.patch(
            f"{SITES_URL}{self.site.pk}/",
            data={"contact_method": ContactMethod.PHONE},
            content_type="application/json",
        )

        self.site.refresh_from_db()
        self.assertEqual(self.site.contact_method, "phone")
        self.assertEqual(self.site.method_of_ordering, "Online portal")


class TrackerImportEndpointTests(TestCase):
    def setUp(self):
        self.upload_dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.upload_dir, ignore_errors=True)

    def post_workbook(self, rows, filename="tracker.xlsx"):
        with override_settings(TRACKER_UPLOAD_DIR=self.upload_dir):
            return self.client.post(
                IMPORT_URL,
                data={"file": upload(build_workbook(rows), filename)},
            )

    def test_imports_a_workbook_and_reports_the_summary(self):
        response = self.post_workbook([site_row("1", "Alpha"), site_row("2", "Beta")])

        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(body["sites_created"], 2)
        self.assertEqual(body["sites_updated"], 0)
        self.assertEqual(Site.objects.count(), 2)

    def test_updates_tracker_owned_fields_on_reimport(self):
        Site.objects.create(site_id="1", name="Old Name", branch="OLD",
                            account_status="Inactive")

        self.post_workbook([site_row("1", "New Name", branch="VAN")])

        site = Site.objects.get(site_id="1")
        self.assertEqual(site.name, "New Name")
        self.assertEqual(site.branch, "VAN")
        self.assertEqual(site.account_status, "Active")

    def test_adds_sites_that_are_new_in_the_export(self):
        Site.objects.create(site_id="1", name="Alpha")

        body = self.post_workbook(
            [site_row("1", "Alpha"), site_row("9", "Brand New")]
        ).json()

        self.assertEqual(body["sites_created"], 1)
        self.assertTrue(Site.objects.filter(site_id="9").exists())

    def test_preserves_a_call_outcome_set_in_the_app(self):
        Site.objects.create(
            site_id="1", name="Alpha", call_outcome=CallOutcome.COMPLETED_SURVEY
        )

        self.post_workbook([site_row("1", "Alpha Renamed")])

        site = Site.objects.get(site_id="1")
        self.assertEqual(site.call_outcome, "completed_survey")
        # The tracker-owned field still updated alongside it.
        self.assertEqual(site.name, "Alpha Renamed")

    def test_preserves_a_contact_method_set_in_the_app(self):
        Site.objects.create(
            site_id="1", name="Alpha", contact_method=ContactMethod.EMAIL
        )

        self.post_workbook([site_row("1", "Alpha Renamed")])

        site = Site.objects.get(site_id="1")
        self.assertEqual(site.contact_method, "email")
        # The tracker-owned field still updated alongside it.
        self.assertEqual(site.name, "Alpha Renamed")

    def test_preserves_call_records_logged_in_the_app(self):
        site = Site.objects.create(site_id="1", name="Alpha")
        logged = CallRecord.objects.create(
            site=site,
            source=CallRecord.Source.APP,
            rep_initials="BC",
            call_date=date(2026, 5, 1),
            notes="Spoke to the manager",
            rating=5,
        )

        row = site_row("1", "Alpha")
        row[15] = 2  # Q3 rating from the sheet
        row[18] = "Imported note"
        self.post_workbook([row])

        logged.refresh_from_db()
        self.assertEqual(logged.notes, "Spoke to the manager")
        self.assertEqual(logged.rating, 5)
        self.assertEqual(logged.source, "app")
        # The sheet's call block lands on a separate imported record.
        self.assertEqual(
            CallRecord.objects.filter(site=site, source="import").count(), 1
        )

    def test_updates_the_existing_imported_record_rather_than_duplicating(self):
        site = Site.objects.create(site_id="1", name="Alpha")
        CallRecord.objects.create(
            site=site, source=CallRecord.Source.IMPORT, call_date=None,
            notes="First pass",
        )

        row = site_row("1", "Alpha")
        row[18] = "Second pass"
        self.post_workbook([row])

        records = CallRecord.objects.filter(site=site, source="import")
        self.assertEqual(records.count(), 1)
        self.assertEqual(records.first().notes, "Second pass")

    def test_updates_rep_assignments_from_the_export(self):
        site = Site.objects.create(site_id="1", name="Alpha")
        RepAssignment.objects.create(site=site, rep_initials="CM")

        self.post_workbook([site_row("1", "Alpha", rep="WH")])

        site.refresh_from_db()
        self.assertEqual(site.rep_assignment.rep_initials, "WH")

    def test_writes_an_import_log_entry(self):
        self.post_workbook([site_row("1", "Alpha")], filename="august.xlsx")

        log = ImportLog.objects.get()
        self.assertEqual(log.filename, "august.xlsx")
        self.assertEqual(log.sites_created, 1)
        self.assertIn("sites_created", log.summary)

    def test_saves_the_uploaded_file(self):
        self.post_workbook([site_row("1", "Alpha")], filename="august.xlsx")

        saved = list(self.upload_dir.glob("*.xlsx"))
        self.assertEqual(len(saved), 1)
        self.assertIn("august", saved[0].name)

    def test_rejects_a_file_that_is_not_xlsx(self):
        with override_settings(TRACKER_UPLOAD_DIR=self.upload_dir):
            response = self.client.post(
                IMPORT_URL,
                data={"file": SimpleUploadedFile("notes.txt", b"nope",
                                                 content_type="text/plain")},
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("file", response.json())
        self.assertEqual(Site.objects.count(), 0)

    def test_rejects_a_request_with_no_file(self):
        with override_settings(TRACKER_UPLOAD_DIR=self.upload_dir):
            response = self.client.post(IMPORT_URL, data={})

        self.assertEqual(response.status_code, 400)
        self.assertIn("file", response.json())

    def test_rejects_a_workbook_without_the_tracker_sheet(self):
        workbook = Workbook()
        workbook.active.title = "Something Else"
        buffer = BytesIO()
        workbook.save(buffer)

        with override_settings(TRACKER_UPLOAD_DIR=self.upload_dir):
            response = self.client.post(
                IMPORT_URL, data={"file": upload(buffer.getvalue())}
            )

        self.assertEqual(response.status_code, 400)
        # A failed run must not be recorded as a successful refresh.
        self.assertEqual(ImportLog.objects.count(), 0)

    def test_get_is_not_allowed(self):
        self.assertEqual(self.client.get(IMPORT_URL).status_code, 405)


class ImportLogListTests(TestCase):
    def test_lists_imports_newest_first(self):
        older = ImportLog.objects.create(filename="july.xlsx")
        newer = ImportLog.objects.create(filename="august.xlsx")

        body = self.client.get(IMPORT_LOG_URL).json()

        self.assertEqual([row["id"] for row in body], [newer.pk, older.pk])
        self.assertEqual(body[0]["filename"], "august.xlsx")

    def test_is_empty_before_any_import(self):
        self.assertEqual(self.client.get(IMPORT_LOG_URL).json(), [])
