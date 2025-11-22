"""Response helper utilities."""

import json
from typing import Any


def json_response(
    status_code: int, body: Any, headers: dict[str, str] | None = None
) -> dict[str, Any]:
    """
    Create a JSON response for AWS Lambda.

    Args:
        status_code: HTTP status code
        body: Response body (will be JSON serialized)
        headers: Optional additional headers

    Returns:
        Lambda proxy response dict
    """
    response_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    if headers:
        response_headers.update(headers)

    return {
        "statusCode": status_code,
        "headers": response_headers,
        "body": json.dumps(body, ensure_ascii=False),
    }


def cors_preflight_response() -> dict[str, Any]:
    """Return CORS preflight response for OPTIONS requests."""
    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        "body": "",
    }
