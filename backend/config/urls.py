"""Root URL configuration for the retention-tracking tool."""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/retention/", include("retention.urls")),
    path("api/analysis/", include("analysis.urls")),
]
