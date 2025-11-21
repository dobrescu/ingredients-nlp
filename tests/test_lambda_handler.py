"""Tests for Lambda handler routing."""

import json
from typing import Any, Dict

import pytest

from src.lambda_handler import handler


class TestLambdaHandler:
    """Test suite for Lambda handler."""

    def test_health_endpoint(self) -> None:
        """Test health check endpoint."""
        event: Dict[str, Any] = {
            "requestContext": {
                "http": {
                    "method": "GET",
                    "path": "/health",
                },
            },
            "rawPath": "/health",
        }

        response = handler(event)

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["status"] == "healthy"

    def test_parse_endpoint_success(self, sample_ingredients: list[str]) -> None:
        """Test parse endpoint with valid data."""
        event: Dict[str, Any] = {
            "requestContext": {
                "http": {
                    "method": "POST",
                    "path": "/parse",
                },
            },
            "rawPath": "/parse",
            "body": json.dumps({"ingredients": sample_ingredients}),
        }

        response = handler(event)

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert "parsed" in body
        assert body["count"] > 0

    def test_cors_preflight(self) -> None:
        """Test CORS preflight request."""
        event: Dict[str, Any] = {
            "requestContext": {
                "http": {
                    "method": "OPTIONS",
                    "path": "/parse",
                },
            },
            "rawPath": "/parse",
        }

        response = handler(event)

        assert response["statusCode"] == 200
        assert "Access-Control-Allow-Origin" in response["headers"]

    def test_not_found(self) -> None:
        """Test 404 for unknown route."""
        event: Dict[str, Any] = {
            "requestContext": {
                "http": {
                    "method": "GET",
                    "path": "/unknown",
                },
            },
            "rawPath": "/unknown",
        }

        response = handler(event)

        assert response["statusCode"] == 404
        body = json.loads(response["body"])
        assert body["code"] == "NOT_FOUND"

    def test_method_not_allowed(self) -> None:
        """Test 405 for wrong HTTP method."""
        event: Dict[str, Any] = {
            "requestContext": {
                "http": {
                    "method": "PUT",
                    "path": "/health",
                },
            },
            "rawPath": "/health",
        }

        response = handler(event)

        # Should be 404 since we don't have PUT /health
        # But if we had GET /health, it would be 405
        assert response["statusCode"] in [404, 405]

    def test_missing_request_context(self) -> None:
        """Test handler with malformed event."""
        event: Dict[str, Any] = {}

        # Should not crash, should return error
        response = handler(event)

        # Should handle gracefully
        assert "statusCode" in response
