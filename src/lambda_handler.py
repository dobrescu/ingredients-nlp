"""
Lambda Handler - RESTful API Router

Simple routing for ingredient parsing endpoints.
"""

from typing import Any, Callable, Dict, List, Optional, Tuple

from src.handlers.health import handle_health
from src.handlers.ingredients import handle_parse_ingredients
from src.middleware.response import cors_preflight_response, json_response
from src.types import ErrorResponse
from src.utils.logger import logger

# Type alias for route handlers
RouteHandler = Callable[[Dict[str, Any]], Dict[str, Any]]


class Route:
    """Route definition with method, path, and handler."""

    def __init__(self, method: str, path: str, handler: RouteHandler) -> None:
        self.method = method
        self.path = path
        self.handler = handler

    def matches(self, method: str, path: str) -> Tuple[bool, Optional[Dict[str, str]]]:
        """
        Check if this route matches the given method and path.

        Args:
            method: HTTP method
            path: Request path

        Returns:
            Tuple of (matches, path_params)
        """
        if self.method != method:
            return False, None

        # Exact match (simple routing for now)
        if self.path == path:
            return True, {}

        # Path parameter matching (e.g., /parse/:id)
        if ":" in self.path:
            pattern_parts = self.path.split("/")
            path_parts = path.split("/")

            if len(pattern_parts) != len(path_parts):
                return False, None

            params: Dict[str, str] = {}
            for pattern_part, path_part in zip(pattern_parts, path_parts):
                if pattern_part.startswith(":"):
                    param_name = pattern_part[1:]
                    params[param_name] = path_part
                elif pattern_part != path_part:
                    return False, None

            return True, params

        return False, None


# Define application routes
routes: List[Route] = [
    Route("GET", "/health", lambda _: handle_health()),
    Route("POST", "/parse", handle_parse_ingredients),
]


def handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    """
    Main Lambda handler with routing.

    Args:
        event: Lambda event dict (API Gateway V2 format)
        context: Lambda context (unused)

    Returns:
        API Gateway response dict
    """
    # Extract request details
    request_context = event.get("requestContext", {})
    http_context = request_context.get("http", {})
    method = http_context.get("method", event.get("httpMethod", "GET"))
    path = http_context.get("path", event.get("path", "/"))

    logger.info("Request received", {"method": method, "path": path})

    try:
        # Handle CORS preflight
        if method == "OPTIONS":
            return cors_preflight_response()

        # Find matching route
        for route in routes:
            matches, params = route.matches(method, path)
            if matches:
                # Add path parameters to event
                if params:
                    event["pathParameters"] = params

                # Execute handler
                response = route.handler(event)
                logger.info(
                    "Request completed",
                    {"method": method, "path": path, "status": response.get("statusCode")},
                )
                return response

        # Check if path exists with different method (405)
        for route in routes:
            _, _ = route.matches("*", path)  # Check path only
            if route.path == path:
                error: ErrorResponse = {
                    "error": "Method Not Allowed",
                    "code": "METHOD_NOT_ALLOWED",
                    "details": {"allowed_methods": [r.method for r in routes if r.path == path]},
                }
                return json_response(405, error)

        # No matching route (404)
        error = {
            "error": "Not Found",
            "code": "NOT_FOUND",
            "details": {"path": path, "method": method},
        }
        return json_response(404, error)

    except Exception as e:
        logger.error("Unhandled error in Lambda handler", {"error": e, "method": method, "path": path})
        error = {
            "error": f"Internal server error: {str(e)}",
            "code": "INTERNAL_ERROR",
            "details": None,
        }
        return json_response(500, error)
