---
name: ingredient-parsing
description: Patterns for Python Lambda handlers and ingredient parsing service
---

# Ingredient Parsing - Lambda Service

## Handler Pattern

```python
def handle_parse_ingredients(event: Dict[str, Any]) -> Dict[str, Any]:
    body = parse_body(event)
    if body is None:
        return json_response(400, {"error": "Missing body", "code": "MISSING_BODY"})

    ingredients = body.get("ingredients")
    if ingredients is None:
        return json_response(400, {"error": "Missing ingredients", "code": "MISSING_INGREDIENTS"})

    try:
        parsed = ingredient_parser_service.parse_ingredients(ingredients)
        return json_response(200, {"parsed": parsed, "count": len(parsed)})
    except Exception as e:
        logger.error("Parse failed", {"error": e})
        return json_response(500, {"error": str(e), "code": "PARSING_FAILED"})
```

## Service Pattern

```python
def parse_ingredients(ingredients: List[str]) -> List[ParsedIngredient]:
    if not ingredients:
        raise ValueError("Empty list")

    results = []
    for ingredient in ingredients:
        try:
            parsed = parse_ingredient(ingredient)
            results.append({"name": parsed.name, "amount": str(parsed.amount)})
        except Exception as e:
            logger.error("Parse failed", {"error": e})
            results.append({"name": ingredient, "amount": None})  # Fallback
    return results
```

## Error Handling Rules

- **Catch at handlers** - Convert to HTTP responses
- **Bubble from services** - Don't catch unless adding context
- **Graceful degradation** - Individual parse failures shouldn't break batch
- **Always log with context** - `logger.error(msg, {"error": e, "ingredient": text})`

## Type Hints Required

```python
def parse_ingredients(ingredients: List[str]) -> List[ParsedIngredient]:
    """Parse ingredient strings."""
    ...
```
