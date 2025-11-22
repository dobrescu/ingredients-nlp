"""Ingredient parsing handlers."""

from typing import Any, Dict

from src.middleware.request import parse_body
from src.middleware.response import json_response
from src.services.ingredient_parser import ingredient_parser_service
from src.types import ErrorResponse, ParseIngredientsRequest, ParseIngredientsResponse
from src.utils.logger import logger


def handle_parse_ingredients(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle POST /parse endpoint - parse a list of ingredients.

    Args:
        event: Lambda event dict

    Returns:
        Lambda response with parsed ingredients
    """
    logger.info("Parse ingredients request received")

    # Parse and validate request body
    body = parse_body(event)
    if body is None:
        error: ErrorResponse = {
            "error": "Request body is required",
            "code": "MISSING_BODY",
            "details": None,
        }
        return json_response(400, error)

    ingredients = body.get("ingredients")
    if ingredients is None:
        error = {
            "error": "Missing required field: ingredients",
            "code": "MISSING_INGREDIENTS",
            "details": None,
        }
        return json_response(400, error)

    if not isinstance(ingredients, list):
        error = {
            "error": "Field 'ingredients' must be a list of strings",
            "code": "INVALID_TYPE",
            "details": {"expected": "list", "got": type(ingredients).__name__},
        }
        return json_response(400, error)

    if len(ingredients) == 0:
        error = {
            "error": "Ingredients list cannot be empty",
            "code": "EMPTY_LIST",
            "details": None,
        }
        return json_response(400, error)

    if len(ingredients) > 100:
        error = {
            "error": "Too many ingredients (max 100)",
            "code": "TOO_MANY_INGREDIENTS",
            "details": {"count": len(ingredients), "max": 100},
        }
        return json_response(400, error)

    try:
        # Parse ingredients using service
        parsed = ingredient_parser_service.parse_ingredients(ingredients)

        response: ParseIngredientsResponse = {
            "parsed": parsed,
            "count": len(parsed),
        }

        logger.info("Successfully parsed ingredients", {"count": len(parsed)})

        return json_response(200, response)

    except ValueError as e:
        logger.error("Validation error", {"error": e})
        error = {
            "error": str(e),
            "code": "VALIDATION_ERROR",
            "details": None,
        }
        return json_response(400, error)

    except Exception as e:
        logger.error("Failed to parse ingredients", {"error": e})
        error = {
            "error": f"Failed to parse ingredients: {str(e)}",
            "code": "PARSING_FAILED",
            "details": None,
        }
        return json_response(500, error)
