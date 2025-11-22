#!/usr/bin/env python3
"""Example usage of the Ingredients NLP API."""

import requests

API_URL = "http://localhost:3000"


def main():
    # Health check
    print("Health:", requests.get(f"{API_URL}/health").json())

    # Parse ingredients
    response = requests.post(
        f"{API_URL}/parse",
        json={
            "ingredients": [
                "2 cups flour",
                "1 teaspoon salt",
                "3 pounds pork shoulder, cut into chunks",
            ]
        },
    )

    result = response.json()
    print(f"\nParsed {result['count']} ingredients:")
    for item in result["parsed"]:
        # Format amount and unit
        amount = item.get("amount", "")
        unit = item.get("unit", "")
        name = item.get("name", "")
        parts = [p for p in [amount, unit, name] if p]
        print(f"  {' '.join(parts)}")

        # Show additional details
        if item.get("preparation"):
            print(f"    → Preparation: {item['preparation']}")
        if item.get("foundation_foods"):
            ff = item["foundation_foods"][0]
            print(f"    → USDA: {ff['text']} (FDC: {ff['fdc_id']})")


if __name__ == "__main__":
    main()
