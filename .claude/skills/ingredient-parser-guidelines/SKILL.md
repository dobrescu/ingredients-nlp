---
name: ingredient-parser-guidelines
description: Guidelines for using the ingredient-parser library. Use when implementing or modifying ingredient parsing logic, handling parse results, or debugging parsing issues.
---

# Ingredient Parser Guidelines

## When this skill should be used

Auto-activates when Claude is:

- Implementing ingredient parsing logic
- Handling parse results from ingredient-parser
- Debugging parsing failures
- Adding new parsing features
- Optimizing batch parsing operations

---

## 1. Library overview

The `ingredient-parser` library uses NLP to parse recipe ingredient strings into structured data.

**Installation**:
```bash
pip install ingredient-parser-nlp
```

**Basic usage**:
```python
from ingredient_parser import parse_ingredient

parsed = parse_ingredient("3 pounds pork shoulder, cut into 2-inch chunks")

print(parsed.name)        # "pork shoulder"
print(parsed.amount)      # 3.0
print(parsed.unit)        # "pound"
print(parsed.preparation) # "cut into 2-inch chunks"
```

---

## 2. ParsedIngredient structure

The library returns a `ParsedIngredient` object with these fields:

```python
class ParsedIngredient:
    """Result from parsing an ingredient string."""

    name: str                    # Main ingredient name (e.g., "flour")
    amount: Optional[float]      # Quantity (e.g., 2.0)
    unit: Optional[str]          # Unit of measurement (e.g., "cup")
    size: Optional[str]          # Size modifier (e.g., "large", "medium")
    preparation: Optional[str]   # Preparation notes (e.g., "diced", "chopped")
    comment: Optional[str]       # Additional comments
    sentence: str                # Original input sentence
```

---

## 3. Common parsing patterns

### Single ingredient

```python
from ingredient_parser import parse_ingredient

result = parse_ingredient("2 cups all-purpose flour")

assert result.name == "all-purpose flour"
assert result.amount == 2.0
assert result.unit == "cup"
```

### Batch parsing

```python
from typing import List
from ingredient_parser import parse_ingredient
from src.types import ParsedIngredient

def parse_ingredients_batch(ingredients: List[str]) -> List[ParsedIngredient]:
    """Parse multiple ingredients with error handling."""
    results = []

    for idx, ingredient in enumerate(ingredients):
        try:
            parsed = parse_ingredient(ingredient)
            results.append({
                "name": parsed.name,
                "amount": str(parsed.amount) if parsed.amount else None,
                "unit": parsed.unit,
                "preparation": parsed.preparation,
                "sentence": ingredient,
            })
        except Exception as e:
            logger.error("Parse failed", {"index": idx, "error": e})
            # Add fallback
            results.append({
                "name": ingredient,
                "amount": None,
                "unit": None,
                "preparation": None,
                "sentence": ingredient,
            })

    return results
```

---

## 4. Handling parse failures

**Common failure scenarios**:
1. Malformed ingredient strings
2. Non-English text
3. Very long or complex descriptions
4. Empty or whitespace-only strings

**Best practices**:
- Always wrap `parse_ingredient()` in try-except
- Provide fallback values for failed parses
- Log failures with context
- Don't let one failure break batch operations

```python
def safe_parse_ingredient(ingredient: str) -> ParsedIngredient:
    """Parse ingredient with graceful fallback."""
    try:
        parsed = parse_ingredient(ingredient)
        return {
            "name": parsed.name,
            "amount": str(parsed.amount) if parsed.amount else None,
            "unit": parsed.unit,
            "preparation": parsed.preparation,
            "sentence": ingredient,
        }
    except Exception as e:
        logger.warning("Parse failed, using fallback", {
            "ingredient": ingredient,
            "error": str(e)
        })
        return {
            "name": ingredient,  # Fallback: use full string as name
            "amount": None,
            "unit": None,
            "preparation": None,
            "sentence": ingredient,
        }
```

---

## 5. Input validation

Always validate input before parsing:

```python
def validate_ingredient_input(ingredients: Any) -> None:
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

    for idx, ingredient in enumerate(ingredients):
        if not isinstance(ingredient, str):
            raise ValueError(f"Ingredient at index {idx} must be a string")

        if not ingredient.strip():
            raise ValueError(f"Ingredient at index {idx} is empty")
```

---

## 6. Response formatting

Convert parser results to API response format:

```python
def format_parse_response(
    parsed: List[ParsedIngredient]
) -> Dict[str, Any]:
    """Format parsed results for API response."""
    return {
        "parsed": parsed,
        "count": len(parsed),
        "timestamp": datetime.utcnow().isoformat(),
    }
```

---

## 7. Common edge cases

### Fractional amounts

```python
# Input: "1 1/2 cups sugar"
# Result: amount = 1.5, unit = "cup", name = "sugar"
```

### Ranges

```python
# Input: "2-3 cloves garlic"
# Result: amount = 2.0 (uses lower bound), name = "garlic"
```

### Multiple preparations

```python
# Input: "1 onion, diced and sautéed"
# Result: preparation = "diced and sautéed"
```

### No amount

```python
# Input: "salt to taste"
# Result: amount = None, name = "salt"
```

---

## 8. Performance considerations

**For batch operations**:
- Parse ingredients sequentially (library isn't async)
- Don't block on failures - use try-except per item
- Consider pagination for very large batches (>100 items)
- Log performance metrics

```python
import time

def parse_with_metrics(ingredients: List[str]) -> Dict[str, Any]:
    """Parse with performance tracking."""
    start_time = time.time()

    parsed = []
    failed = 0

    for ingredient in ingredients:
        try:
            result = parse_ingredient(ingredient)
            parsed.append(result)
        except Exception:
            failed += 1

    duration = time.time() - start_time

    logger.info("Parsing complete", {
        "total": len(ingredients),
        "parsed": len(parsed),
        "failed": failed,
        "duration_seconds": duration,
    })

    return {"parsed": parsed, "metrics": {
        "duration_seconds": duration,
        "success_rate": len(parsed) / len(ingredients)
    }}
```

---

## 9. Testing parsing logic

```python
import pytest
from src.services.ingredient_parser import IngredientParserService

def test_parse_basic_ingredient():
    """Test parsing a basic ingredient."""
    service = IngredientParserService()
    result = service.parse_single_ingredient("2 cups flour")

    assert result["name"] == "flour"
    assert result["amount"] == "2.0"
    assert result["unit"] == "cup"

def test_parse_with_preparation():
    """Test ingredient with preparation."""
    service = IngredientParserService()
    result = service.parse_single_ingredient("1 onion, diced")

    assert result["name"] == "onion"
    assert "diced" in result["preparation"]

def test_parse_empty_string():
    """Test parsing empty string."""
    service = IngredientParserService()

    with pytest.raises(ValueError, match="cannot be empty"):
        service.parse_single_ingredient("")
```

---

## 10. Quick reference

### Parse single ingredient
```python
from ingredient_parser import parse_ingredient

parsed = parse_ingredient("2 cups flour")
```

### Access result fields
```python
name = parsed.name
amount = parsed.amount
unit = parsed.unit
preparation = parsed.preparation
```

### Handle errors
```python
try:
    parsed = parse_ingredient(text)
except Exception as e:
    logger.error("Parse failed", {"error": e})
    # Use fallback
```

---

Related skills: `backend-dev-guidelines`, `error-handling-guidelines`

Last updated: 2025-11-21
