"""DRF views for the retention app.

Reads are open and writes are deliberately narrow: a Site accepts partial
updates to four user-owned fields only, and CallRecords can be created but not
edited or deleted. Permission classes are a later step.
"""
from pathlib import Path

from rest_framework import generics, mixins, status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .importer import ImportError_, describe, run_ingest, store_upload, validate_upload
from .models import CallRecord, ImportLog, Site
from .serializers import (
    CallRecordSerializer,
    ImportLogSerializer,
    SiteSerializer,
    SiteUpdateSerializer,
)


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


class TrackerImportView(APIView):
    """Accept a fresh tracker export and re-run the ingest over it.

    The ingest is deliberately re-run rather than reimplemented, so an upload
    behaves exactly like ``manage.py ingest_tracker``: tracker-owned fields are
    refreshed and new sites appear, while this tool's own data — a site's
    ``call_outcome`` and any CallRecord with ``source='app'`` — is left alone.
    """

    parser_classes = [MultiPartParser, FormParser]
    http_method_names = ["post", "options"]

    def post(self, request, *args, **kwargs):
        uploaded = request.FILES.get("file")

        try:
            validate_upload(uploaded)
        except ImportError_ as exc:
            return Response(
                {"file": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST
            )

        destination = store_upload(uploaded)

        try:
            summary = run_ingest(destination)
        except ImportError_ as exc:
            # A workbook that could not be read is not a refresh: drop the file
            # and leave no ImportLog behind to imply otherwise.
            destination.unlink(missing_ok=True)
            return Response(
                {"file": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST
            )

        log = ImportLog.objects.create(
            filename=Path(uploaded.name).name,
            stored_path=str(destination),
            sites_created=summary.get("sites_created", 0),
            sites_updated=summary.get("sites_updated", 0),
            warning_count=summary.get("warning_count", 0),
            summary=summary,
        )

        return Response(
            {
                **summary,
                "import_id": log.pk,
                "filename": log.filename,
                "imported_at": log.imported_at,
                "message": describe(summary),
            }
        )


class ImportLogListView(generics.ListAPIView):
    """The import history, newest first, for the header's "last updated"."""

    queryset = ImportLog.objects.all()
    serializer_class = ImportLogSerializer
