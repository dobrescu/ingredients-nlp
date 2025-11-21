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
        print(f"  {item['amount']} {item['unit']} {item['name']}")
        if item.get("preparation"):
            print(f"    → {item['preparation']}")


if __name__ == "__main__":
    main()
