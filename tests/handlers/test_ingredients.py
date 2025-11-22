"""Tests for ingredients handler."""

import json
from typing import Any, Dict

import pytest

from src.handlers.ingredients import handle_parse_ingredients


class TestHandleParseIngredients:
    """Test suite for parse ingredients handler."""

    def test_parse_ingredients_success(
        self, lambda_event_base: Dict[str, Any], sample_ingredients: list[str]
    ) -> None:
        """Test successful ingredient parsing."""
        event = {
            **lambda_event_base,
            "body": json.dumps({"ingredients": sample_ingredients}),
        }

        response = handle_parse_ingredients(event)

        assert response["statusCode"] == 200

        body = json.loads(response["body"])
        assert "parsed" in body
        assert "count" in body
        assert body["count"] == len(sample_ingredients)
        assert len(body["parsed"]) == len(sample_ingredients)

    def test_parse_ingredients_missing_body(self, lambda_event_base: Dict[str, Any]) -> None:
        """Test request without body."""
        event = {**lambda_event_base}

        response = handle_parse_ingredients(event)

        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["code"] == "MISSING_BODY"

    def test_parse_ingredients_empty_body(self, lambda_event_base: Dict[str, Any]) -> None:
        """Test request with empty body."""
        event = {
            **lambda_event_base,
            "body": json.dumps({}),
        }

        response = handle_parse_ingredients(event)

        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["code"] == "MISSING_INGREDIENTS"

    def test_parse_ingredients_invalid_type(self, lambda_event_base: Dict[str, Any]) -> None:
        """Test request with invalid ingredients type."""
        event = {
            **lambda_event_base,
            "body": json.dumps({"ingredients": "not a list"}),
        }

        response = handle_parse_ingredients(event)

        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["code"] == "INVALID_TYPE"

    def test_parse_ingredients_empty_list(self, lambda_event_base: Dict[str, Any]) -> None:
        """Test request with empty ingredients list."""
        event = {
            **lambda_event_base,
            "body": json.dumps({"ingredients": []}),
        }

        response = handle_parse_ingredients(event)

        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["code"] == "EMPTY_LIST"

    def test_parse_ingredients_too_many(self, lambda_event_base: Dict[str, Any]) -> None:
        """Test request with too many ingredients."""
        too_many = ["ingredient"] * 101

        event = {
            **lambda_event_base,
            "body": json.dumps({"ingredients": too_many}),
        }

        response = handle_parse_ingredients(event)

        assert response["statusCode"] == 400
        body = json.loads(response["body"])
        assert body["code"] == "TOO_MANY_INGREDIENTS"

    def test_parse_ingredients_single(self, lambda_event_base: Dict[str, Any]) -> None:
        """Test parsing a single ingredient."""
        event = {
            **lambda_event_base,
            "body": json.dumps({"ingredients": ["2 cups flour"]}),
        }

        response = handle_parse_ingredients(event)

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["count"] == 1
        assert body["parsed"][0]["name"] == "flour"

    def test_parse_ingredients_malformed_json(self, lambda_event_base: Dict[str, Any]) -> None:
        """Test request with malformed JSON."""
        event = {
            **lambda_event_base,
            "body": "not valid json",
        }

        response = handle_parse_ingredients(event)

        assert response["statusCode"] == 400
