---
name: error-handling-guidelines
description: Error handling patterns for Ingredients NLP API. Use when adding try-except blocks, designing error propagation, logging failures, or deciding between graceful degradation vs hard failure.
---

# Error Handling Guidelines - Ingredients NLP

## When this skill should be used

Auto-activates when Claude is:

- Adding or modifying `try-except` blocks
- Designing error propagation between handlers and services
- Adding error logging
- Implementing graceful degradation for optional features
- Deciding when to catch vs let errors bubble

Behavioral rules:

- Default to minimal try-except at boundaries only
- Let errors bubble from services
- Always use shared `logger` with context
- Catch for graceful degradation of optional features
- Never swallow errors silently

---

## 1. Core principle: Minimal try-except

**Question**: Should every function have a `try-except`?
**Answer**: No.

```python
# ❌ OVER-ENGINEERED
async def load_recipe(url: str) -> Recipe:
    try:
        cached = await get_from_cache(url)
        return cached
    except Exception as error:
        raise error  # Pointless - just rethrowing

# ✅ GOOD - Let errors bubble
def parse_ingredients(ingredients: List[str]) -> List[ParsedIngredient]:
    if not ingredients:
        raise ValueError("Ingredients list cannot be empty")
    return [parse_ingredient(i) for i in ingredients]
```

**When to use try-except**:
1. Lambda handler boundaries (convert to HTTP responses)
2. Graceful degradation (optional features)
3. Adding context before rethrowing

**When NOT to use try-except**:
1. Middle of call chain (let it bubble)
2. Just to rethrow immediately
3. Service layer (pure business logic)

---

## 2. Error boundaries

### Handler boundary (catch and map to HTTP)

```python
def handle_parse_ingredients(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle POST /parse endpoint."""
    body = parse_body(event)
    if not body:
        return json_response(400, {
            "error": "Request body is required",
            "code": "MISSING_BODY"
        })

    ingredients = body.get("ingredients")
    if not ingredients:
        return json_response(400, {
            "error": "Missing required field: ingredients",
            "code": "MISSING_INGREDIENTS"
        })

    try:
        parsed = ingredient_parser_service.parse_ingredients(ingredients)
        return json_response(200, {"parsed": parsed, "count": len(parsed)})
    except ValueError as e:
        logger.error("Validation error", {"error": e})
        return json_response(400, {
            "error": str(e),
            "code": "VALIDATION_ERROR"
        })
    except Exception as e:
        logger.error("Failed to parse ingredients", {"error": e})
        return json_response(500, {
            "error": f"Failed to parse: {str(e)}",
            "code": "PARSING_FAILED"
        })
```

**Pattern**: Validation → try-except → service call → HTTP response

---

## 3. Graceful degradation

For optional features that shouldn't break main flow:

```python
# Parse with fallback for individual failures
parsed_results: List[ParsedIngredient] = []

for idx, ingredient_str in enumerate(ingredients):
    try:
        parsed = parse_ingredient(ingredient_str)
        parsed_results.append(parsed)
    except Exception as e:
        logger.error("Failed to parse ingredient", {
            "index": idx,
            "ingredient": ingredient_str,
            "error": e
        })
        # Add fallback result
        parsed_results.append({
            "sentence": ingredient_str,
            "name": ingredient_str,  # Fallback
            "amount": None,
            "unit": None
        })
```

**Use when**:
- Feature improves UX but isn't required
- Failure shouldn't block main operation
- Individual items in batch operations

---

## 4. Logger usage

Always use shared logger with structured context:

```python
from src.utils.logger import logger

# Info logging
logger.info("Parsing ingredients", {"count": len(ingredients)})

# Warning logging
logger.warning("Skipping empty ingredient", {"index": idx})

# Error logging with context
try:
    parsed = parse_ingredient(ingredient)
except Exception as e:
    logger.error("Failed to parse ingredient", {
        "error": e,
        "ingredient": ingredient,
        "index": idx
    })
```

**Guidelines**:
- Log once at the boundary where you handle the error
- Include identifiers: `index`, `ingredient`, `count`
- Pass full exception object to logger
- Use structured context (dicts) not string formatting

**Logger API**:
```python
logger.info(message, context)
logger.warning(message, context)
logger.error(message, context)
logger.debug(message, context)
```

---

## 5. Validation that raises

Use functions that raise instead of returning booleans:

```python
def validate_ingredients(ingredients: Any) -> None:
    """Validate ingredients list.

    Raises:
        ValueError: If validation fails
    """
    if not isinstance(ingredients, list):
        raise ValueError("Ingredients must be a list")

    if len(ingredients) == 0:
        raise ValueError("Ingredients list cannot be empty")

    if len(ingredients) > 100:
        raise ValueError(f"Too many ingredients (max 100, got {len(ingredients)})")

# Usage - raises if invalid
validate_ingredients(data)
# Code here only runs if valid
```

**Why**: Simpler control flow, better type inference.

---

## 6. Custom exception classes

For complex applications, use custom exceptions:

```python
class IngredientParsingError(Exception):
    """Base exception for ingredient parsing errors."""
    pass

class InvalidIngredientError(IngredientParsingError):
    """Raised when ingredient format is invalid."""
    pass

class EmptyIngredientListError(IngredientParsingError):
    """Raised when ingredient list is empty."""
    pass

# Usage
if not ingredients:
    raise EmptyIngredientListError("Ingredients list cannot be empty")
```

**Benefits**: More specific error handling, better error messages

---

## 7. Quick decision guide

```
Should I add try-except here?

Is this a Lambda handler?              → YES (catch, log, map to HTTP)
Is this handling individual items?     → YES (graceful degradation)
Is this a service method?              → NO (let errors bubble)
Am I just rethrowing immediately?      → NO (remove try-except)
```

---

## 8. Best practices summary

1. **Catch at boundaries**: Lambda handlers primary, batch operations secondary
2. **Let errors bubble**: Services don't catch
3. **Always log with context**: Use `logger.error(msg, {"error": e, ...})`
4. **Graceful degradation**: Don't let one failure break entire batch
5. **Validation raises**: Use functions that raise, not boolean returns
6. **Error messages**: Include identifiers (index, ingredient) in logs
7. **Never swallow**: If you catch, either handle or rethrow with context

---

Related skills: `backend-dev-guidelines`, `python-best-practices`

Last updated: 2025-11-21
