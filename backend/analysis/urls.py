"""URL routing for the analysis app."""
from django.urls import path

from .views import RevenueRiskScoreView

urlpatterns = [
    path(
        "revenue-risk-score/",
        RevenueRiskScoreView.as_view(),
        name="revenue-risk-score",
    ),
]
