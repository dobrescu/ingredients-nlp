# Testing Guide

Comprehensive testing guide for the Ingredients NLP service.

## Overview

The project uses pytest for testing with:
- Unit tests for services
- Integration tests for handlers
- End-to-end tests for Lambda handler
- Code coverage reporting
- Type checking with mypy
- Linting with ruff

## Test Structure

```
tests/
├── conftest.py                    # Shared fixtures
├── test_lambda_handler.py         # Integration tests
├── handlers/                      # Handler tests
│   ├── test_health.py
│   └── test_ingredients.py
├── services/                      # Service tests
│   └── test_ingredient_parser.py
└── middleware/                    # Middleware tests
```

## Running Tests

### All tests
```bash
make test
```

### Specific test file
```bash
pytest tests/services/test_ingredient_parser.py -v
```

### Specific test function
```bash
pytest tests/services/test_ingredient_parser.py::TestIngredientParserService::test_parse_single_ingredient_basic -v
```

### With coverage
```bash
pytest tests/ --cov=src --cov-report=html
# Open htmlcov/index.html in browser
```

### Watch mode (auto-run on changes)
```bash
pytest-watch tests/ -v
```

## Test Categories

### Unit Tests

Test individual components in isolation:

```python
def test_parse_single_ingredient_basic():
    """Test parsing a basic ingredient."""
    service = IngredientParserService()
    result = service.parse_single_ingredient("2 cups flour")

    assert result["name"] == "flour"
    assert result["amount"] == "2.0"
    assert result["unit"] == "cup"
```

### Integration Tests

Test handler functions with full request/response flow:

```python
def test_parse_ingredients_success(lambda_event_base, sample_ingredients):
    """Test successful ingredient parsing."""
    event = {
        **lambda_event_base,
        "body": json.dumps({"ingredients": sample_ingredients}),
    }

    response = handle_parse_ingredients(event)

    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert "parsed" in body
```

### End-to-End Tests

Test complete Lambda handler routing:

```python
def test_parse_endpoint_success(sample_ingredients):
    """Test parse endpoint with valid data."""
    event = {
        "requestContext": {
            "http": {"method": "POST", "path": "/parse"}
        },
        "body": json.dumps({"ingredients": sample_ingredients}),
    }

    response = handler(event)
    assert response["statusCode"] == 200
```

## Fixtures

### Sample Ingredients

```python
@pytest.fixture
def sample_ingredients():
    """Sample ingredient strings for testing."""
    return [
        "2 cups all-purpose flour",
        "1 teaspoon salt",
        "3 pounds pork shoulder, cut into 2-inch chunks",
    ]
```

### Lambda Event

```python
@pytest.fixture
def lambda_event_base():
    """Base Lambda event structure."""
    return {
        "requestContext": {
            "http": {"method": "POST", "path": "/parse"}
        },
        "rawPath": "/parse",
        "headers": {"content-type": "application/json"},
    }
```

## Writing Tests

### Test Naming Convention

- File: `test_*.py`
- Class: `Test*`
- Function: `test_*`

### Test Organization

```python
class TestIngredientParserService:
    """Test suite for IngredientParserService."""

    def test_init(self):
        """Test service initialization."""
        ...

    def test_parse_single_ingredient_basic(self):
        """Test parsing a basic ingredient."""
        ...

    def test_parse_single_ingredient_empty(self):
        """Test parsing empty ingredient string."""
        ...
```

### Assertions

Use clear, descriptive assertions:

```python
# ✅ GOOD - Clear assertions
assert result["name"] == "flour"
assert result["amount"] == "2.0"
assert "diced" in result.get("preparation", "")

# ❌ BAD - Vague assertions
assert result
assert result["name"]
```

### Error Testing

Test error conditions:

```python
def test_parse_single_ingredient_empty():
    """Test parsing empty ingredient string."""
    service = IngredientParserService()

    with pytest.raises(ValueError, match="cannot be empty"):
        service.parse_single_ingredient("")
```

## Coverage Goals

- **Minimum**: 80% overall coverage
- **Target**: 90% coverage for services
- **Critical paths**: 100% coverage for handlers

Check coverage:
```bash
pytest tests/ --cov=src --cov-report=term-missing
```

## Continuous Integration

Tests run automatically on:
- Every push to main/develop
- Every pull request

GitHub Actions workflow (`.github/workflows/test.yml`):
- Run tests
- Check code formatting
- Run linting
- Type checking
- Generate coverage report

## Mocking

For external dependencies:

```python
from unittest.mock import Mock, patch

def test_with_mock():
    """Test with mocked dependency."""
    with patch('src.services.ingredient_parser.parse_ingredient') as mock_parse:
        mock_parse.return_value = Mock(
            name="flour",
            amount=2.0,
            unit="cup"
        )

        service = IngredientParserService()
        result = service.parse_single_ingredient("2 cups flour")

        mock_parse.assert_called_once()
```

## Performance Testing

Test performance for batch operations:

```python
import time

def test_parse_performance():
    """Test parsing performance."""
    service = IngredientParserService()
    ingredients = ["2 cups flour"] * 50

    start = time.time()
    results = service.parse_ingredients(ingredients)
    duration = time.time() - start

    assert len(results) == 50
    assert duration < 5.0  # Should complete in under 5 seconds
```

## Best Practices

1. **One assertion per test** (when possible)
2. **Descriptive test names** - Explain what's being tested
3. **AAA pattern** - Arrange, Act, Assert
4. **Independent tests** - No shared state between tests
5. **Fast tests** - Keep tests quick (< 1 second each)
6. **Clear error messages** - Use descriptive assertion messages

## Debugging Tests

### Run with verbose output
```bash
pytest tests/ -vv
```

### Show print statements
```bash
pytest tests/ -s
```

### Stop on first failure
```bash
pytest tests/ -x
```

### Run last failed tests
```bash
pytest tests/ --lf
```

### Drop into debugger on failure
```bash
pytest tests/ --pdb
```

## Common Issues

### Import errors
```python
# Make sure PYTHONPATH is set
export PYTHONPATH=/app

# Or run from project root
pytest tests/
```

### Fixture not found
```python
# Ensure conftest.py is in the right location
tests/conftest.py  # Root fixtures
tests/services/conftest.py  # Service-specific fixtures
```

### Async tests
```python
# Use pytest-asyncio for async tests
import pytest

@pytest.mark.asyncio
async def test_async_function():
    result = await some_async_function()
    assert result is not None
```

## Test Maintenance

- Review and update tests when code changes
- Remove obsolete tests
- Keep test data fixtures up to date
- Update tests when API contracts change
- Add tests for new features
- Add tests for bug fixes

## Resources

- [pytest documentation](https://docs.pytest.org/)
- [pytest-cov documentation](https://pytest-cov.readthedocs.io/)
- [Python testing best practices](https://docs.python-guide.org/writing/tests/)
