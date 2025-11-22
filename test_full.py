#!/usr/bin/env python3
"""Test full structure."""

from ingredient_parser import parse_ingredient

test_cases = [
    "2-3 cups flour",
    "about 1 large onion, diced",
    "fresh parsley for garnish",
]

for test in test_cases:
    print(f"\n{'='*60}")
    print(f"Input: {test}")
    print('='*60)
    result = parse_ingredient(test)

    # Name
    if result.name:
        if isinstance(result.name, list):
            print(f"Name: {result.name[0].text} (conf: {result.name[0].confidence:.3f})")
        else:
            print(f"Name: {result.name}")

    # Amount
    if result.amount and len(result.amount) > 0:
        amt = result.amount[0]
        print(f"Amount: {amt.quantity} -> {amt.quantity_max}")
        print(f"  RANGE: {amt.RANGE}")
        print(f"  APPROXIMATE: {amt.APPROXIMATE}")
        print(f"  SINGULAR: {amt.SINGULAR}")
        print(f"  Confidence: {amt.confidence:.3f}")
        if amt.unit:
            print(f"Unit: {amt.unit}")

    # Foundation foods
    print(f"Foundation foods: {result.foundation_foods}")

    # Purpose
    if result.purpose:
        if isinstance(result.purpose, list):
            print(f"Purpose: {result.purpose[0].text} (conf: {result.purpose[0].confidence:.3f})")
        elif hasattr(result.purpose, 'text'):
            print(f"Purpose: {result.purpose.text} (conf: {result.purpose.confidence:.3f})")
