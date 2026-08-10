"""DRF views for the retention app.

Read-only for now; write access and permission classes are a later step.
"""
from rest_framework import viewsets

from .models import CallRecord, Site
from .serializers import CallRecordSerializer, SiteSerializer


class SiteViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Site.objects.all().prefetch_related(
        "revenue_snapshots"
    ).select_related("rep_assignment")
    serializer_class = SiteSerializer


class CallRecordViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CallRecord.objects.select_related("site").all()
    serializer_class = CallRecordSerializer
