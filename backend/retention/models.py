"""Data models for the retention-tracking tool."""
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class CallOutcome(models.TextChoices):
    """How a site was classified after call attempts.

    These mirror the colour-coded legend in rows 2-9 of the tracker
    spreadsheet. They are set in this tool rather than read from the export,
    so an ingest run must leave them untouched.
    """

    NO_ASSETS = "no_assets", "No assets/route dormant"
    COMPLETED_SURVEY = "completed_survey", "Completed survey"
    INVALID_CONTACT = "invalid_contact", "Missing/invalid contact details"
    FOLLOW_UP = "follow_up", "Follow up/Issue (Seed ticket or email the branch)"
    AWAITING_EMAIL = "awaiting_email", "Awaiting email response"
    FRENCH_ACCOUNT = "french_account", "French accounts"
    LEFT_VM = "left_vm", "Left VM/call back"
    TEMP_CLOSED = "temp_closed", "Temp closed due to season"


class Site(models.Model):
    """A canteen/vending site tracked for retention purposes.

    ``site_id`` corresponds to the '#' column in the source tracker and is
    treated as the stable external identifier for a site.
    """

    site_id = models.CharField(max_length=64, unique=True)
    # False when ``site_id`` was synthesised from name+address because the
    # tracker's '#' column was blank for that row.
    has_native_id = models.BooleanField(default=True)
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True)
    branch = models.CharField(max_length=255, blank=True)
    lob = models.CharField(max_length=255, blank=True)
    phone_number = models.CharField(max_length=64, blank=True)
    contact_name = models.CharField(max_length=255, blank=True)
    method_of_ordering = models.CharField(max_length=255, blank=True)
    account_status = models.CharField(max_length=128, blank=True)
    # The unmodified tracker text behind ``account_status``, kept so a bad
    # normalisation rule can be diagnosed and re-run without a fresh export.
    raw_account_status = models.CharField(max_length=255, blank=True)
    last_order_date = models.DateField(null=True, blank=True)
    # Owned by this tool, not the tracker export: blank until a rep classifies
    # the site, and deliberately excluded from the ingest command's writes.
    call_outcome = models.CharField(
        max_length=32, choices=CallOutcome.choices, blank=True, default=""
    )
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ["site_id"]

    def __str__(self):
        return f"{self.site_id} — {self.name}"


class RevenueSnapshot(models.Model):
    """A point-in-time revenue reading for a site."""

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="revenue_snapshots",
    )
    snapshot_date = models.DateField()
    f25_revenue = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True
    )
    annual_revenue = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True
    )

    class Meta:
        ordering = ["-snapshot_date"]

    def __str__(self):
        return f"{self.site.site_id} @ {self.snapshot_date}"


class RepAssignment(models.Model):
    """The sales rep currently assigned to a site."""

    site = models.OneToOneField(
        Site,
        on_delete=models.CASCADE,
        related_name="rep_assignment",
    )
    rep_initials = models.CharField(max_length=16)

    def __str__(self):
        return f"{self.site.site_id} -> {self.rep_initials}"


class CallRecord(models.Model):
    """A record of a rep's call/visit to a site.

    ``source`` separates calls actually made through this tool ("app") from
    legacy rows carried over from the tracker spreadsheet ("import"). Only
    app-sourced records count as a site having been called.
    """

    class Source(models.TextChoices):
        IMPORT = "import", "Imported from tracker"
        APP = "app", "Logged in app"

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="call_records",
    )
    # Defaults to IMPORT so the ingest path and the migration backfill both
    # classify their rows as legacy; the API create path overrides with APP.
    source = models.CharField(
        max_length=16, choices=Source.choices, default=Source.IMPORT
    )
    rep_initials = models.CharField(max_length=16, blank=True)
    call_date = models.DateField(null=True, blank=True)
    duration_minutes = models.IntegerField(null=True, blank=True)
    q1_last_order_feedback = models.TextField(blank=True)
    q2_working_well = models.TextField(blank=True)
    rating = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    q4_could_improve = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    actions_required = models.TextField(blank=True)
    data_corrections = models.TextField(blank=True)
    corrections_applied = models.BooleanField(default=False)

    class Meta:
        ordering = ["-call_date"]

    def __str__(self):
        return f"Call {self.site.site_id} ({self.call_date})"


class ImportLog(models.Model):
    """One record per tracker import run, newest first.

    Exists so the UI can answer "when was this data last refreshed?" without
    re-reading the spreadsheet, and so a bad import can be traced back to the
    file that caused it.
    """

    filename = models.CharField(max_length=255)
    stored_path = models.CharField(max_length=512, blank=True)
    imported_at = models.DateTimeField(auto_now_add=True)
    sites_created = models.IntegerField(default=0)
    sites_updated = models.IntegerField(default=0)
    warning_count = models.IntegerField(default=0)
    # The command's full machine-readable summary, kept verbatim so new
    # counters show up in the UI without another migration.
    summary = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-imported_at"]

    def __str__(self):
        return f"{self.filename} @ {self.imported_at:%Y-%m-%d %H:%M}"


class StatusHistory(models.Model):
    """An append-only log of a site's account status over time.

    Every ingestion run adds a new row per site recording that site's current
    status; existing rows are never updated or deleted. ``Site.account_status``
    remains the source of truth for the *current* status — this table exists so
    status changes stay queryable as a trend.
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    status = models.CharField(max_length=64)
    raw_status = models.CharField(max_length=128)
    observed_date = models.DateField()

    class Meta:
        ordering = ["-observed_date"]

    def __str__(self):
        return f"{self.site.site_id} status {self.status} @ {self.observed_date}"
