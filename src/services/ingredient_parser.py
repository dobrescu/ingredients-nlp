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
                # Parse with foundation_foods enabled to get USDA matches
                parsed = parse_ingredient(ingredient_str, foundation_foods=True)

                # Helper to extract text and confidence from IngredientText objects
                def extract_field(field):
                    if field is None:
                        return None, 0.0
                    # Handle list of IngredientText objects (for name field)
                    if isinstance(field, list) and len(field) > 0:
                        return field[0].text, field[0].confidence
                    if hasattr(field, "text"):
                        return field.text, field.confidence
                    return str(field), 1.0

                # Extract fields with confidence
                name_text, name_conf = extract_field(parsed.name)
                size_text, size_conf = extract_field(getattr(parsed, "size", None))
                prep_text, prep_conf = extract_field(getattr(parsed, "preparation", None))
                comment_text, comment_conf = extract_field(getattr(parsed, "comment", None))
                purpose_text, purpose_conf = extract_field(getattr(parsed, "purpose", None))

                # Extract amount, unit, and flags
                amount_text, amount_max_text, amount_conf, unit_text, unit_conf = None, None, 0.0, None, 0.0
                is_range, is_approximate, is_singular = False, False, False

                if parsed.amount and len(parsed.amount) > 0:
                    first_amount = parsed.amount[0]
                    # Convert Fraction to float for consistent formatting
                    if getattr(first_amount, "quantity", None) is not None:
                        amount_text = str(float(first_amount.quantity))
                        amount_conf = getattr(first_amount, "confidence", 1.0)
                    if getattr(first_amount, "quantity_max", None) is not None:
                        amount_max_text = str(float(first_amount.quantity_max))
                    if getattr(first_amount, "unit", None) is not None:
                        unit_text, unit_conf = extract_field(first_amount.unit)
                    # Extract boolean flags
                    is_range = getattr(first_amount, "RANGE", False)
                    is_approximate = getattr(first_amount, "APPROXIMATE", False)
                    is_singular = getattr(first_amount, "SINGULAR", False)

                # Extract foundation foods
                foundation_foods = [
                    {
                        "text": ff.text,
                        "confidence": ff.confidence,
                        "fdc_id": ff.fdc_id,
                        "category": ff.category,
                        "data_type": ff.data_type,
                        "url": ff.url,
                    }
                    for ff in parsed.foundation_foods
                ] if parsed.foundation_foods else []

                # Convert the parsed result to our typed dict format
                result: ParsedIngredient = {
                    "sentence": ingredient_str,
                    "name": name_text or "",
                    "size": size_text,
                    "amount": amount_text,
                    "amount_max": amount_max_text,
                    "unit": unit_text,
                    "comment": comment_text,
                    "preparation": prep_text,
                    "purpose": purpose_text,
                    "is_range": is_range,
                    "is_approximate": is_approximate,
                    "is_singular": is_singular,
                    "confidence": {
                        "name": name_conf,
                        "size": size_conf,
                        "amount": amount_conf,
                        "unit": unit_conf,
                        "comment": comment_conf,
                        "preparation": prep_conf,
                        "purpose": purpose_conf,
                    },
                    "foundation_foods": foundation_foods,
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
                    "amount_max": None,
                    "unit": None,
                    "comment": None,
                    "preparation": None,
                    "purpose": None,
                    "is_range": False,
                    "is_approximate": False,
                    "is_singular": False,
                    "confidence": {
                        "name": 0.0,
                        "size": 0.0,
                        "amount": 0.0,
                        "unit": 0.0,
                        "comment": 0.0,
                        "preparation": 0.0,
                        "purpose": 0.0,
                    },
                    "foundation_foods": [],
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
