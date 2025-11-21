---
name: backend-dev-guidelines
description: Backend development patterns for the Ingredients NLP API using AWS Lambda, API Gateway HTTP APIs (v2), and Python. Use when editing or creating Lambda handlers, API routes, services, or application business logic.
---

# Backend Development Guidelines - Ingredients NLP

## When this skill should be used

Auto-activates when Claude is:

- Editing or creating Lambda handlers or API Gateway routes
- Working on services, handlers, or business logic
- Integrating with AWS services or third-party libraries
- Reviewing or refactoring backend code for consistency
- Designing new endpoints or features

Behavioral rules:

- Prefer small, incremental changes over large rewrites
- Preserve existing contracts (types, APIs)
- Keep handlers thin - business logic belongs in services
- Always use strict type hints (mypy strict mode)
- Catch errors at boundaries, let them bubble internally

---

## 1. Service architecture

### Pattern: Handler → Service → External Library

```
Handler     → Thin routing, validation, HTTP mapping
Service     → Business logic, orchestration
Library     → External functionality (ingredient-parser)
```

**Services** should be classes with clear initialization:

```python
class IngredientParserService:
    """Service for parsing ingredient strings."""

    def __init__(self) -> None:
        """Initialize the service."""
        logger.info("IngredientParserService initialized")

    def parse_ingredients(self, ingredients: List[str]) -> List[ParsedIngredient]:
        """Parse ingredients into structured data."""
        # Implementation
```

**Handlers** should:
- Parse and validate input
- Call services
- Map results to HTTP responses
- Handle errors at the boundary

**Services** should:
- Implement business logic
- Remain platform-agnostic (no API Gateway types)
- Use type hints for all parameters and returns

---

## 2. Lambda and API Gateway patterns

### Handler structure (simple routing)

```python
from typing import Any, Callable, Dict, List, Tuple

RouteHandler = Callable[[Dict[str, Any]], Dict[str, Any]]

class Route:
    """Route definition with method, path, and handler."""

    def __init__(self, method: str, path: str, handler: RouteHandler) -> None:
        self.method = method
        self.path = path
        self.handler = handler

routes: List[Route] = [
    Route("GET", "/health", lambda _: handle_health()),
    Route("POST", "/parse", handle_parse_ingredients),
]

def handler(event: Dict[str, Any], context: Any = None) -> Dict[str, Any]:
    """Main Lambda handler with routing."""
    request_context = event.get("requestContext", {})
    http_context = request_context.get("http", {})
    method = http_context.get("method", "GET")
    path = http_context.get("path", "/")

    if method == "OPTIONS":
        return cors_preflight_response()

    for route in routes:
        matches, params = route.matches(method, path)
        if matches:
            return route.handler(event)

    return json_response(404, {"error": "Not Found"})
```

### Individual route handlers

```python
def handle_parse_ingredients(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle POST /parse endpoint."""
    # Parse body
    body = parse_body(event)
    if not body:
        return json_response(400, {
            "error": "Request body is required",
            "code": "MISSING_BODY"
        })

    # Validate
    ingredients = body.get("ingredients")
    if not ingredients or not isinstance(ingredients, list):
        return json_response(400, {
            "error": "Missing required field: ingredients",
            "code": "INVALID_REQUEST"
        })

    try:
        # Process
        parsed = ingredient_parser_service.parse_ingredients(ingredients)
        return json_response(200, {
            "parsed": parsed,
            "count": len(parsed)
        })
    except Exception as e:
        logger.error("Failed to parse ingredients", {"error": e})
        return json_response(500, {
            "error": f"Failed to parse: {str(e)}",
            "code": "PARSING_FAILED"
        })
```

---

## 3. Python best practices

### Type hints are mandatory

Use strict type hints for all functions:

```python
from typing import Any, Dict, List, Optional

def parse_ingredients(ingredients: List[str]) -> List[ParsedIngredient]:
    """Parse ingredient strings."""
    ...

def json_response(
    status_code: int,
    body: Any,
    headers: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """Create JSON response."""
    ...
```

### Use TypedDict for structured data

```python
from typing import TypedDict

class ParsedIngredient(TypedDict, total=False):
    """Parsed ingredient structure."""
    name: str
    amount: Optional[str]
    unit: Optional[str]
    preparation: Optional[str]
    sentence: str
```

### Docstrings for all public functions

Use Google-style docstrings:

```python
def parse_ingredients(self, ingredients: List[str]) -> List[ParsedIngredient]:
    """
    Parse a list of ingredient strings into structured data.

    Args:
        ingredients: List of ingredient strings to parse

    Returns:
        List of parsed ingredient objects

    Raises:
        ValueError: If ingredients list is empty or invalid
        Exception: If parsing fails
    """
```

### Use dataclasses for configuration

```python
from dataclasses import dataclass

@dataclass
class Config:
    """Application configuration."""
    aws_region: str = "us-east-1"
    log_level: str = "INFO"
```

---

## 4. Error handling

**Core principle**: Catch at boundaries, let errors bubble internally.

```python
# ✅ Handler boundary
def handle_parse_ingredients(event: Dict[str, Any]) -> Dict[str, Any]:
    try:
        parsed = service.parse_ingredients(ingredients)
        return json_response(200, {"parsed": parsed})
    except ValueError as e:
        logger.error("Validation error", {"error": e})
        return json_response(400, {"error": str(e)})
    except Exception as e:
        logger.error("Parsing failed", {"error": e})
        return json_response(500, {"error": "Internal error"})

# ✅ Service - let errors bubble
def parse_ingredients(self, ingredients: List[str]) -> List[ParsedIngredient]:
    if not ingredients:
        raise ValueError("Ingredients list cannot be empty")
    return [parse_ingredient(i) for i in ingredients]
```

---

## 5. Logging

Always use structured logger with context:

```python
from src.utils.logger import logger

# Info logging
logger.info("Parsing ingredients", {"count": len(ingredients)})

# Error logging with context
try:
    result = service.parse(data)
except Exception as e:
    logger.error("Parsing failed", {"error": e, "data_length": len(data)})
    raise
```

---

## 6. Testing

Write tests for all services and handlers:

```python
import pytest
from src.services.ingredient_parser import IngredientParserService

def test_parse_single_ingredient():
    """Test parsing a single ingredient."""
    service = IngredientParserService()
    result = service.parse_single_ingredient("2 cups flour")

    assert result["name"] == "flour"
    assert result["amount"] == "2"
    assert result["unit"] == "cups"
```

---

## 7. Quick reference

### Common imports

```python
from typing import Any, Dict, List, Optional

from src.middleware.request import parse_body
from src.middleware.response import json_response
from src.services.ingredient_parser import ingredient_parser_service
from src.types import ParsedIngredient, ErrorResponse
from src.utils.logger import logger
```

### Response helper

```python
def json_response(
    status_code: int,
    body: Any,
    headers: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """Create JSON response for Lambda."""
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body)
    }
```

---

Related skills: `error-handling-guidelines`, `python-best-practices`, `ingredient-parser-guidelines`

Last updated: 2025-11-21
