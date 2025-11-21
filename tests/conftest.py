"""Pytest configuration and fixtures."""

import pytest
from typing import Any, Dict


@pytest.fixture
def sample_ingredients() -> list[str]:
    """Sample ingredient strings for testing."""
    return [
        "2 cups all-purpose flour",
        "1 teaspoon salt",
        "3 pounds pork shoulder, cut into 2-inch chunks",
        "1 large onion, diced",
        "2-3 cloves garlic, minced",
    ]


@pytest.fixture
def lambda_event_base() -> Dict[str, Any]:
    """Base Lambda event structure."""
    return {
        "requestContext": {
            "http": {
                "method": "POST",
                "path": "/parse",
            },
        },
        "rawPath": "/parse",
        "headers": {
            "content-type": "application/json",
        },
    }


@pytest.fixture
def parse_request_body(sample_ingredients: list[str]) -> Dict[str, Any]:
    """Sample parse request body."""
    return {
        "ingredients": sample_ingredients,
    }
