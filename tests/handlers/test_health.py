"""Tests for health handler."""

import json

from src.handlers.health import handle_health


def test_handle_health():
    """Test health check handler."""
    response = handle_health()

    assert response["statusCode"] == 200
    assert "Content-Type" in response["headers"]
    assert response["headers"]["Content-Type"] == "application/json"

    body = json.loads(response["body"])
    assert body["status"] == "healthy"
    assert body["service"] == "ingredients-nlp"
    assert "version" in body
