"""Admin registrations for the retention app."""
from django.contrib import admin

from .models import CallRecord, RepAssignment, RevenueSnapshot, Site


class RevenueSnapshotInline(admin.TabularInline):
    model = RevenueSnapshot
    extra = 0


class RepAssignmentInline(admin.StackedInline):
    model = RepAssignment
    extra = 0


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = (
        "site_id",
        "name",
        "branch",
        "lob",
        "account_status",
        "last_order_date",
    )
    list_filter = ("branch", "lob", "account_status")
    search_fields = ("site_id", "name", "contact_name", "address")
    inlines = [RepAssignmentInline, RevenueSnapshotInline]


@admin.register(RevenueSnapshot)
class RevenueSnapshotAdmin(admin.ModelAdmin):
    list_display = ("site", "snapshot_date", "f25_revenue", "annual_revenue")
    list_filter = ("snapshot_date",)
    search_fields = ("site__site_id", "site__name")


@admin.register(RepAssignment)
class RepAssignmentAdmin(admin.ModelAdmin):
    list_display = ("site", "rep_initials")
    search_fields = ("site__site_id", "site__name", "rep_initials")


@admin.register(CallRecord)
class CallRecordAdmin(admin.ModelAdmin):
    list_display = ("site", "rep_initials", "call_date", "rating")
    list_filter = ("rep_initials", "rating", "call_date")
    search_fields = ("site__site_id", "site__name", "notes")
