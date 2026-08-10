"""Views for the analysis app."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView


class RevenueRiskScoreView(APIView):
    """Placeholder for revenue-risk scoring.

    Scoring will be delegated to an R script via ``analysis.r_bridge`` in a
    later step. For now it advertises that it is not yet implemented.
    """

    def get(self, request, *args, **kwargs):
        return Response(
            {"detail": "Revenue risk scoring is not yet implemented."},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )
