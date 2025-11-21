#!/usr/bin/env python3
"""
Example Python client for Ingredients NLP API.

Usage:
    python examples/example_requests.py
"""

import os
import sys
from typing import List, Dict, Any

import requests

# API configuration
API_URL = os.getenv("API_URL", "http://localhost:3000")


def health_check() -> None:
    """Check API health."""
    print("📊 Health Check")
    response = requests.get(f"{API_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    print()


def parse_ingredients(ingredients: List[str]) -> Dict[str, Any]:
    """
    Parse a list of ingredients.

    Args:
        ingredients: List of ingredient strings

    Returns:
        Parsed ingredients response
    """
    response = requests.post(
        f"{API_URL}/parse",
        json={"ingredients": ingredients},
    )
    response.raise_for_status()
    return response.json()


def example_basic_parsing() -> None:
    """Example: Parse basic ingredients."""
    print("🔍 Basic Ingredient Parsing")

    ingredients = [
        "2 cups flour",
        "1 teaspoon salt",
        "3 tablespoons butter",
    ]

    result = parse_ingredients(ingredients)

    print(f"Parsed {result['count']} ingredients:")
    for item in result["parsed"]:
        amount = item.get("amount", "")
        unit = item.get("unit", "")
        name = item.get("name", "")
        print(f"  - {amount} {unit} {name}")
    print()


def example_complex_parsing() -> None:
    """Example: Parse complex ingredients."""
    print("🔬 Complex Ingredient Parsing")

    ingredients = [
        "3 pounds pork shoulder, cut into 2-inch chunks",
        "1 large onion, diced",
        "2-3 cloves garlic, minced",
        "1 1/2 cups chicken stock",
    ]

    result = parse_ingredients(ingredients)

    print(f"Parsed {result['count']} ingredients:")
    for item in result["parsed"]:
        name = item.get("name", "")
        amount = item.get("amount", "")
        unit = item.get("unit", "")
        prep = item.get("preparation", "")

        print(f"  - {amount} {unit} {name}")
        if prep:
            print(f"    Preparation: {prep}")
    print()


def example_recipe_parsing() -> None:
    """Example: Parse complete recipe."""
    print("🍰 Recipe Ingredient Parsing")

    recipe_ingredients = [
        "2 cups all-purpose flour",
        "2 teaspoons baking powder",
        "1/2 teaspoon salt",
        "1/2 cup unsalted butter, softened",
        "1 cup granulated sugar",
        "2 large eggs",
        "1 teaspoon vanilla extract",
        "1/2 cup whole milk",
    ]

    result = parse_ingredients(recipe_ingredients)

    print("Recipe Ingredients:")
    print("-" * 50)
    for item in result["parsed"]:
        sentence = item.get("sentence", "")
        name = item.get("name", "")
        amount = item.get("amount", "")
        unit = item.get("unit", "")

        print(f"Original: {sentence}")
        print(f"Parsed:   {amount} {unit} {name}")
        print()


def example_error_handling() -> None:
    """Example: Handle API errors."""
    print("❌ Error Handling Examples")

    # Empty list
    try:
        response = requests.post(
            f"{API_URL}/parse",
            json={"ingredients": []},
        )
        print(f"Empty list: {response.status_code} - {response.json()['error']}")
    except Exception as e:
        print(f"Error: {e}")

    # Missing field
    try:
        response = requests.post(
            f"{API_URL}/parse",
            json={},
        )
        print(f"Missing field: {response.status_code} - {response.json()['error']}")
    except Exception as e:
        print(f"Error: {e}")

    print()


def main() -> None:
    """Run all examples."""
    print("🧪 Ingredients NLP API Examples")
    print(f"API URL: {API_URL}")
    print("=" * 60)
    print()

    try:
        health_check()
        example_basic_parsing()
        example_complex_parsing()
        example_recipe_parsing()
        example_error_handling()

        print("✅ All examples completed successfully!")

    except requests.exceptions.ConnectionError:
        print(f"❌ Error: Could not connect to API at {API_URL}")
        print("Make sure the server is running (make dev)")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
