"""DRF serializers for the retention app."""
from rest_framework import serializers

from .models import CallRecord, RepAssignment, RevenueSnapshot, Site


class RevenueSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = RevenueSnapshot
        fields = [
            "id",
            "snapshot_date",
            "f25_revenue",
            "annual_revenue",
        ]


class RepAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = RepAssignment
        fields = ["id", "rep_initials"]


class SiteSerializer(serializers.ModelSerializer):
    revenue_snapshots = RevenueSnapshotSerializer(many=True, read_only=True)
    rep_assignment = RepAssignmentSerializer(read_only=True)

    class Meta:
        model = Site
        fields = [
            "id",
            "site_id",
            "name",
            "address",
            "branch",
            "lob",
            "phone_number",
            "contact_name",
            "method_of_ordering",
            "account_status",
            "last_order_date",
            "latitude",
            "longitude",
            "rep_assignment",
            "revenue_snapshots",
        ]


class CallRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = CallRecord
        fields = [
            "id",
            "site",
            "rep_initials",
            "call_date",
            "duration_minutes",
            "q1_last_order_feedback",
            "q2_working_well",
            "rating",
            "q4_could_improve",
            "notes",
            "actions_required",
        ]
