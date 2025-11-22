"""Health check handler."""

from typing import Any

from src import __version__
from src.middleware.response import json_response
from src.types import HealthResponse


def handle_health() -> dict[str, Any]:
    """
    Handle health check requests.

    Returns:
        Lambda response with health status
    """
    response: HealthResponse = {
        "status": "healthy",
        "service": "ingredients-nlp",
        "version": __version__,
    }

    return json_response(200, response)
