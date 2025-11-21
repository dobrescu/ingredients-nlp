---
name: python-best-practices
description: Python coding standards and best practices for the Ingredients NLP service. Use when writing or reviewing Python code for type safety, formatting, and idiomatic patterns.
---

# Python Best Practices - Ingredients NLP

## When this skill should be used

Auto-activates when Claude is:

- Writing new Python modules or functions
- Reviewing code for style consistency
- Adding type hints or documentation
- Refactoring existing Python code
- Setting up linting or formatting tools

Behavioral rules:

- Always use strict type hints (mypy strict mode)
- Follow PEP 8 and PEP 484 (type hints)
- Use Black for code formatting (100 char line length)
- Write Google-style docstrings
- Prefer composition over inheritance

---

## 1. Type hints (mandatory)

### All function signatures must have types

```python
from typing import Any, Dict, List, Optional

# ✅ GOOD
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

# ❌ BAD - No type hints
def parse_ingredients(ingredients):
    ...
```

### Use TypedDict for structured data

```python
from typing import TypedDict, Optional

class ParsedIngredient(TypedDict, total=False):
    """Parsed ingredient structure."""
    name: str
    amount: Optional[str]
    unit: Optional[str]
    preparation: Optional[str]
    sentence: str
```

### Use type aliases for complex types

```python
from typing import Dict, Any, Callable

# Type alias
RouteHandler = Callable[[Dict[str, Any]], Dict[str, Any]]

# Usage
def register_route(path: str, handler: RouteHandler) -> None:
    ...
```

---

## 2. Docstrings (Google style)

### Module docstrings

```python
"""Ingredient parsing service using ingredient-parser library.

This module provides the IngredientParserService class for parsing
recipe ingredient strings into structured data.
"""
```

### Function docstrings

```python
def parse_ingredients(self, ingredients: List[str]) -> List[ParsedIngredient]:
    """
    Parse a list of ingredient strings into structured data.

    Args:
        ingredients: List of ingredient strings to parse

    Returns:
        List of parsed ingredient objects with name, amount, unit, etc.

    Raises:
        ValueError: If ingredients list is empty or invalid
        Exception: If parsing fails unexpectedly
    """
```

### Class docstrings

```python
class IngredientParserService:
    """Service for parsing ingredient strings into structured data.

    This service wraps the ingredient-parser library and provides
    error handling, logging, and batch processing capabilities.

    Attributes:
        None (stateless service)

    Example:
        >>> service = IngredientParserService()
        >>> result = service.parse_single_ingredient("2 cups flour")
        >>> print(result["name"])
        flour
    """
```

---

## 3. Code formatting (Black)

Use Black with 100 character line length:

```python
# pyproject.toml
[tool.black]
line-length = 100
target-version = ["py312"]

# Format code
# $ black src/
```

### Key Black rules

- Single quotes for strings
- 4 spaces for indentation
- Trailing commas in multi-line structures
- One blank line between methods
- Two blank lines between top-level definitions

---

## 4. Linting (Ruff)

Use Ruff for fast linting:

```python
# pyproject.toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = [
    "E",   # pycodestyle errors
    "W",   # pycodestyle warnings
    "F",   # pyflakes
    "I",   # isort (import sorting)
    "B",   # flake8-bugbear
    "C4",  # flake8-comprehensions
    "UP",  # pyupgrade
]

# Run linting
# $ ruff check src/
```

---

## 5. Type checking (mypy)

Use mypy in strict mode:

```python
# pyproject.toml
[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true

# Run type checking
# $ mypy src/
```

---

## 6. Project structure

```
ingredients-nlp/
├── src/
│   ├── __init__.py
│   ├── lambda_handler.py      # Main entry point
│   ├── env.py                 # Configuration
│   ├── types.py               # Type definitions
│   ├── handlers/              # Request handlers
│   │   ├── __init__.py
│   │   ├── health.py
│   │   └── ingredients.py
│   ├── middleware/            # Request/response utilities
│   │   ├── __init__.py
│   │   ├── request.py
│   │   └── response.py
│   ├── services/              # Business logic
│   │   ├── __init__.py
│   │   └── ingredient_parser.py
│   └── utils/                 # Utilities
│       ├── __init__.py
│       └── logger.py
├── tests/                     # Tests mirror src structure
│   ├── __init__.py
│   ├── test_lambda_handler.py
│   └── services/
│       └── test_ingredient_parser.py
├── requirements.txt
├── requirements-dev.txt
├── pyproject.toml
└── README.md
```

---

## 7. Import organization

Use isort (via Ruff) for import sorting:

```python
# Standard library
import json
import os
from typing import Any, Dict, List, Optional

# Third-party
from ingredient_parser import parse_ingredient

# Local
from src.middleware.response import json_response
from src.types import ParsedIngredient
from src.utils.logger import logger
```

**Order**:
1. Standard library
2. Third-party packages
3. Local imports

---

## 8. Function and variable naming

### Functions and methods: snake_case

```python
def parse_ingredients() -> List[ParsedIngredient]:
    ...

def json_response(status_code: int) -> Dict[str, Any]:
    ...
```

### Classes: PascalCase

```python
class IngredientParserService:
    ...

class ParsedIngredient(TypedDict):
    ...
```

### Constants: UPPER_SNAKE_CASE

```python
MAX_INGREDIENTS = 100
DEFAULT_LOG_LEVEL = "INFO"
```

### Private methods: _leading_underscore

```python
class Service:
    def _sanitize_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Private helper method."""
        ...
```

---

## 9. Exception handling patterns

```python
# ✅ GOOD - Specific exceptions
try:
    parsed = parse_ingredient(text)
except ValueError as e:
    logger.error("Validation failed", {"error": e})
    raise
except KeyError as e:
    logger.error("Missing required field", {"error": e})
    raise

# ❌ BAD - Bare except
try:
    parsed = parse_ingredient(text)
except:
    pass
```

---

## 10. Context managers

Use context managers for resource handling:

```python
# File handling
with open("data.json", "r") as f:
    data = json.load(f)

# Custom context manager
from contextlib import contextmanager

@contextmanager
def timer(operation: str):
    """Time an operation."""
    start = time.time()
    try:
        yield
    finally:
        duration = time.time() - start
        logger.info(f"{operation} took {duration:.2f}s")

# Usage
with timer("Parsing ingredients"):
    results = parse_ingredients(data)
```

---

## 11. List comprehensions

Prefer comprehensions over map/filter when readable:

```python
# ✅ GOOD
parsed = [parse_ingredient(i) for i in ingredients if i.strip()]

# ✅ Also good for complex logic
parsed = []
for ingredient in ingredients:
    if ingredient.strip():
        try:
            parsed.append(parse_ingredient(ingredient))
        except Exception as e:
            logger.error("Parse failed", {"error": e})

# ❌ Avoid nested comprehensions
# Too complex - use regular loops
```

---

## 12. Quick checklist

Before committing code:

- [ ] All functions have type hints
- [ ] All functions have docstrings
- [ ] Imports are organized (stdlib, third-party, local)
- [ ] Code formatted with Black
- [ ] No linting errors (ruff)
- [ ] Type checking passes (mypy)
- [ ] Tests written and passing
- [ ] No bare `except:` clauses
- [ ] Logging uses structured context

---

Related skills: `backend-dev-guidelines`, `error-handling-guidelines`

Last updated: 2025-11-21
