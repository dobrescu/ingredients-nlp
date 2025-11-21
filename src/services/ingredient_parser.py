"""Ingredient parsing service using ingredient-parser library."""

from typing import List

from ingredient_parser import parse_ingredient

from src.types import ParsedIngredient
from src.utils.logger import logger


class IngredientParserService:
    """Service for parsing ingredient strings into structured data."""

    def __init__(self) -> None:
        """Initialize the ingredient parser service."""
        logger.info("IngredientParserService initialized")

    def parse_ingredients(self, ingredients: List[str]) -> List[ParsedIngredient]:
        """
        Parse a list of ingredient strings into structured data.

        Args:
            ingredients: List of ingredient strings to parse

        Returns:
            List of parsed ingredient objects

        Raises:
            ValueError: If ingredients list is empty or invalid
            Exception: If parsing fails
        """
        if not ingredients:
            raise ValueError("Ingredients list cannot be empty")

        if not isinstance(ingredients, list):
            raise ValueError("Ingredients must be a list of strings")

        logger.info("Parsing ingredients", {"count": len(ingredients)})

        parsed_results: List[ParsedIngredient] = []

        for idx, ingredient_str in enumerate(ingredients):
            if not isinstance(ingredient_str, str):
                logger.warning(
                    "Skipping non-string ingredient",
                    {"index": idx, "type": type(ingredient_str).__name__},
                )
                continue

            if not ingredient_str.strip():
                logger.warning("Skipping empty ingredient", {"index": idx})
                continue

            try:
                parsed = parse_ingredient(ingredient_str)

                # Convert the parsed result to our typed dict format
                result: ParsedIngredient = {
                    "sentence": ingredient_str,
                    "name": parsed.name if parsed.name else "",
                    "size": parsed.size if hasattr(parsed, "size") else None,
                    "amount": str(parsed.amount) if parsed.amount else None,
                    "unit": parsed.unit if parsed.unit else None,
                    "comment": parsed.comment if hasattr(parsed, "comment") else None,
                    "preparation": parsed.preparation if hasattr(parsed, "preparation") else None,
                }

                parsed_results.append(result)

                logger.debug(
                    "Successfully parsed ingredient",
                    {"index": idx, "ingredient": ingredient_str, "result": result},
                )

            except Exception as e:
                logger.error(
                    "Failed to parse ingredient",
                    {"index": idx, "ingredient": ingredient_str, "error": e},
                )
                # Add a fallback result with the original sentence
                parsed_results.append({
                    "sentence": ingredient_str,
                    "name": ingredient_str,  # Fallback to full string
                    "size": None,
                    "amount": None,
                    "unit": None,
                    "comment": None,
                    "preparation": None,
                })

        logger.info(
            "Ingredient parsing complete",
            {"total": len(ingredients), "parsed": len(parsed_results)},
        )

        return parsed_results

    def parse_single_ingredient(self, ingredient: str) -> ParsedIngredient:
        """
        Parse a single ingredient string.

        Args:
            ingredient: Ingredient string to parse

        Returns:
            Parsed ingredient object

        Raises:
            ValueError: If ingredient is empty or invalid
        """
        if not ingredient or not ingredient.strip():
            raise ValueError("Ingredient string cannot be empty")

        results = self.parse_ingredients([ingredient])
        return results[0]


# Global service instance
ingredient_parser_service = IngredientParserService()
