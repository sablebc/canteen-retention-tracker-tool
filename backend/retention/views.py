"""DRF views for the retention app.

Reads are open and writes are deliberately narrow: a Site accepts partial
updates to four user-owned fields only, and CallRecords can be created but not
edited or deleted. Permission classes are a later step.
"""
from rest_framework import mixins, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import CallRecord, Site
from .serializers import CallRecordSerializer, SiteSerializer, SiteUpdateSerializer


class SiteViewSet(mixins.UpdateModelMixin, viewsets.ReadOnlyModelViewSet):
    """List/retrieve every site, and PATCH the fields a rep may correct.

    PUT is excluded: a full replace would require the client to echo back the
    tracker-owned fields it is not allowed to change.
    """

    http_method_names = ["get", "patch", "head", "options"]
    queryset = Site.objects.all().prefetch_related(
        "revenue_snapshots"
    ).select_related("rep_assignment")
    serializer_class = SiteSerializer

    def get_serializer_class(self):
        if self.action == "partial_update":
            return SiteUpdateSerializer
        return SiteSerializer

    def update(self, request, *args, **kwargs):
        """Apply a partial update, then respond in the list serializer's shape.

        The panel replaces its copy of the site with this response, so it must
        match what the list endpoint returns rather than the four-field
        update payload.
        """
        site = self.get_object()
        serializer = SiteUpdateSerializer(site, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(SiteSerializer(site).data)


class CallRecordViewSet(
    mixins.CreateModelMixin, viewsets.ReadOnlyModelViewSet
):
    """List and create call records; filter the list with ``?site=<pk>``."""

    http_method_names = ["get", "post", "head", "options"]
    serializer_class = CallRecordSerializer

    def get_queryset(self):
        # Newest first, with the primary key breaking ties: the tracker import
        # leaves call_date null on every historical row, so date alone would
        # order those arbitrarily between requests.
        queryset = CallRecord.objects.select_related("site").order_by(
            "-call_date", "-id"
        )

        site = self.request.query_params.get("site")
        if site is None:
            return queryset

        try:
            site_pk = int(site)
        except (TypeError, ValueError):
            raise ValidationError(
                {"site": "Must be a site primary key (an integer)."}
            ) from None

        return queryset.filter(site_id=site_pk)
