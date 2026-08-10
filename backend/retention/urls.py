"""URL routing for the retention app."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CallRecordViewSet,
    ImportLogListView,
    SiteViewSet,
    TrackerImportView,
)

router = DefaultRouter()
router.register(r"sites", SiteViewSet, basename="site")
router.register(r"calls", CallRecordViewSet, basename="callrecord")

urlpatterns = [
    path("import/", TrackerImportView.as_view(), name="tracker-import"),
    path("imports/", ImportLogListView.as_view(), name="import-log-list"),
    *router.urls,
]
