"""DRF serializers for the retention app."""
from django.utils import timezone
from rest_framework import serializers

from .models import CallRecord, RepAssignment, RevenueSnapshot, Site

# The only Site fields a user may edit from the detail panel. Everything else
# on a Site comes from the tracker export and is overwritten on the next
# ingest, so allowing edits elsewhere would silently lose the change.
EDITABLE_SITE_FIELDS = (
    "method_of_ordering",
    "contact_name",
    "lob",
    "phone_number",
)


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


class SiteUpdateSerializer(serializers.ModelSerializer):
    """Validates a partial update to the handful of user-owned Site fields.

    DRF ignores unrecognised keys by default. That is the wrong behaviour here:
    a panel that PATCHes a field the API silently drops looks like it saved.
    Unknown keys are therefore rejected outright.
    """

    class Meta:
        model = Site
        fields = list(EDITABLE_SITE_FIELDS)

    def validate(self, attrs):
        submitted = set(self.initial_data or {})
        rejected = submitted - set(EDITABLE_SITE_FIELDS)
        if rejected:
            raise serializers.ValidationError(
                {
                    name: "This field is not editable."
                    for name in sorted(rejected)
                }
            )
        return attrs


class CallRecordSerializer(serializers.ModelSerializer):
    # The model leaves this blank-able for the ingest path, where the tracker
    # sometimes has no RS value. A call logged by hand always names its rep.
    rep_initials = serializers.CharField(max_length=16)

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
            "data_corrections",
        ]

    def create(self, validated_data):
        """Default an omitted call date to today rather than storing null."""
        if validated_data.get("call_date") is None:
            validated_data["call_date"] = timezone.localdate()
        return super().create(validated_data)
