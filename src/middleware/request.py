"""Request parsing utilities."""

import json
from typing import Any

from src.utils.logger import logger


def parse_body(event: dict[str, Any], expected_type: type | None = None) -> dict[str, Any] | None:
    """
    Parse JSON body from Lambda event.

    Args:
        event: Lambda event dict
        expected_type: Optional type to validate against

    Returns:
        Parsed body dict or None if parsing fails
    """
    body = event.get("body")
    if not body:
        return None

    try:
        parsed = json.loads(body) if isinstance(body, str) else body

        if expected_type and not isinstance(parsed, expected_type):
            logger.warning(
                "Body type mismatch",
                {"expected": expected_type.__name__, "got": type(parsed).__name__},
            )
            return None

        return parsed
    except json.JSONDecodeError as e:
        logger.error("Failed to parse request body", {"error": e})
        return None


def get_path_param(event: dict[str, Any], param_name: str) -> str | None:
    """
    Extract path parameter from Lambda event.

    Args:
        event: Lambda event dict
        param_name: Parameter name to extract

    Returns:
        Parameter value or None if not found
    """
    path_params = event.get("pathParameters")
    if not path_params:
        return None

    return path_params.get(param_name)


def get_query_param(event: dict[str, Any], param_name: str) -> str | None:
    """
    Extract query parameter from Lambda event.

    Args:
        event: Lambda event dict
        param_name: Parameter name to extract

    Returns:
        Parameter value or None if not found
    """
    query_params = event.get("queryStringParameters")
    if not query_params:
        return None

    return query_params.get(param_name)
