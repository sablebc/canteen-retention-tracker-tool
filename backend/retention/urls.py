"""URL routing for the retention app."""
from rest_framework.routers import DefaultRouter

from .views import CallRecordViewSet, SiteViewSet

router = DefaultRouter()
router.register(r"sites", SiteViewSet, basename="site")
router.register(r"calls", CallRecordViewSet, basename="callrecord")

urlpatterns = router.urls
