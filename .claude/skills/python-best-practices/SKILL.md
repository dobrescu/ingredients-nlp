---
name: python-best-practices
description: Modern Python 3.12+ best practices and patterns (2024-2025)
---

# Python Best Practices (Python 3.12+)

## Type Hints - Modern Syntax (PEP 585, PEP 604)

**Use native collections** (Python 3.9+):
```python
# ✅ Modern (Python 3.9+)
def process(items: list[str]) -> dict[str, int]:
    return {item: len(item) for item in items}

# ❌ Old style (deprecated)
from typing import List, Dict
def process(items: List[str]) -> Dict[str, int]:
    ...
```

**Union types with `|`** (Python 3.10+):
```python
# ✅ Modern
def get_value(key: str) -> str | None:
    ...

# ❌ Old style
from typing import Optional, Union
def get_value(key: str) -> Optional[str]:
    ...
```

## Type Annotations - Best Practices

**Always annotate function signatures**:
```python
# ✅ Clear, type-safe
def parse_ingredient(text: str, strict: bool = False) -> ParsedIngredient:
    ...

# ❌ No type hints
def parse_ingredient(text, strict=False):
    ...
```

**Avoid `Any` - be specific**:
```python
# ✅ Specific types
def process_data(data: dict[str, str | int]) -> list[ParsedResult]:
    ...

# ❌ Too generic
from typing import Any
def process_data(data: Any) -> Any:
    ...
```

**Use TypedDict for structured dicts**:
```python
# ✅ Type-safe dictionary structure
class UserData(TypedDict):
    name: str
    age: int
    email: str | None

def get_user() -> UserData:
    return {"name": "Alice", "age": 30, "email": None}

# ❌ Untyped dictionary
def get_user() -> dict:
    ...
```

## Dataclasses - Modern Data Structures

**Use dataclasses for data containers**:
```python
from dataclasses import dataclass

# ✅ Clean, automatic __init__, __repr__, __eq__
@dataclass
class IngredientAmount:
    quantity: float
    unit: str
    confidence: float = 1.0

# ❌ Manual boilerplate
class IngredientAmount:
    def __init__(self, quantity, unit, confidence=1.0):
        self.quantity = quantity
        self.unit = unit
        self.confidence = confidence
```

**Frozen dataclasses for immutability**:
```python
@dataclass(frozen=True)
class Config:
    api_key: str
    timeout: int = 30
```

## Error Handling

**Be specific with exceptions**:
```python
# ✅ Specific exception types
def parse_amount(text: str) -> float:
    if not text:
        raise ValueError("Amount cannot be empty")
    try:
        return float(text)
    except ValueError as e:
        raise ValueError(f"Invalid amount: {text}") from e

# ❌ Bare except
def parse_amount(text):
    try:
        return float(text)
    except:  # Catches everything, even KeyboardInterrupt
        return None
```

**Use context managers** (`with`):
```python
# ✅ Automatic cleanup
with open("file.txt") as f:
    data = f.read()

# ❌ Manual cleanup
f = open("file.txt")
data = f.read()
f.close()
```

## Code Style (PEP 8 + Modern Extensions)

**Line length**: 88-100 characters (Black/Ruff standard)

**Import ordering**:
```python
# 1. Standard library
import json
import os
from typing import Any, Dict

# 2. Third-party
import boto3
from fastapi import FastAPI

# 3. Local
from src.types import ParsedIngredient
from src.utils.logger import logger
```

**Type annotation spacing** (PEP 8):
```python
# ✅ Correct spacing
def func(x: int = 0) -> str:
    value: str = "hello"
    return value

# ❌ Wrong spacing
def func(x:int=0)->str:
    value : str = "hello"
    return value
```

## Modern Patterns

**Use `getattr()` with defaults**:
```python
# ✅ Clean, handles missing attributes
amount = getattr(parsed, "amount", None)

# ❌ Verbose
if hasattr(parsed, "amount"):
    amount = parsed.amount
else:
    amount = None
```

**List/dict comprehensions over loops**:
```python
# ✅ Pythonic, faster
results = [process(item) for item in items if item.valid]

# ❌ Verbose
results = []
for item in items:
    if item.valid:
        results.append(process(item))
```

**f-strings for formatting**:
```python
# ✅ Modern, readable
message = f"Parsed {count} ingredients in {elapsed:.2f}s"

# ❌ Old style
message = "Parsed {} ingredients in {:.2f}s".format(count, elapsed)
```

## Constants and Immutability

**Use `Final` for constants**:
```python
from typing import Final

# ✅ Type-checked constant
MAX_INGREDIENTS: Final = 100
API_VERSION: Final = "v1"

# ❌ Convention only (not enforced)
MAX_INGREDIENTS = 100
```

**NEVER use mutable defaults**:
```python
# ✅ Safe
def process(items: list[str] | None = None) -> list[str]:
    if items is None:
        items = []
    return items

# ❌ DANGEROUS - shared mutable default
def process(items: list[str] = []) -> list[str]:
    items.append("new")  # Modifies shared list!
    return items
```

## Mypy Strict Configuration

```toml
[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
disallow_any_explicit = false  # Allow explicit Any when needed
```

## Key Principles

1. **Type everything** - Functions, variables, returns
2. **Use native types** - `list[str]` not `List[str]`
3. **Be specific** - Avoid `Any`, use unions `str | int`
4. **Dataclasses** - For structured data
5. **TypedDict** - For dictionary schemas
6. **No mutable defaults** - Use `None` and check
7. **f-strings** - For all string formatting
8. **Comprehensions** - Over explicit loops
9. **Context managers** - For resource management
10. **PEP 8** - Follow style guide (use Black/Ruff)
