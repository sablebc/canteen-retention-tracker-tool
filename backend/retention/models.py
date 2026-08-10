"""Data models for the retention-tracking tool."""
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


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
    """A record of a rep's call/visit to a site."""

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="call_records",
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
