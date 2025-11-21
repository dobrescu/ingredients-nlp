"""Tests for ingredient parser service."""

import pytest

from src.services.ingredient_parser import IngredientParserService


class TestIngredientParserService:
    """Test suite for IngredientParserService."""

    def test_init(self) -> None:
        """Test service initialization."""
        service = IngredientParserService()
        assert service is not None

    def test_parse_single_ingredient_basic(self) -> None:
        """Test parsing a basic ingredient."""
        service = IngredientParserService()
        result = service.parse_single_ingredient("2 cups flour")

        assert result["name"] == "flour"
        assert result["amount"] == "2.0"
        assert result["unit"] == "cup"
        assert result["sentence"] == "2 cups flour"

    def test_parse_single_ingredient_with_preparation(self) -> None:
        """Test parsing ingredient with preparation."""
        service = IngredientParserService()
        result = service.parse_single_ingredient("1 onion, diced")

        assert result["name"] == "onion"
        assert result["amount"] == "1.0"
        assert "diced" in (result.get("preparation") or "")

    def test_parse_single_ingredient_with_description(self) -> None:
        """Test parsing ingredient with description."""
        service = IngredientParserService()
        result = service.parse_single_ingredient("2 cups all-purpose flour")

        assert "flour" in result["name"]
        assert result["amount"] == "2.0"
        assert result["unit"] == "cup"

    def test_parse_single_ingredient_empty(self) -> None:
        """Test parsing empty ingredient string."""
        service = IngredientParserService()

        with pytest.raises(ValueError, match="cannot be empty"):
            service.parse_single_ingredient("")

    def test_parse_single_ingredient_whitespace(self) -> None:
        """Test parsing whitespace-only ingredient."""
        service = IngredientParserService()

        with pytest.raises(ValueError, match="cannot be empty"):
            service.parse_single_ingredient("   ")

    def test_parse_ingredients_list(self, sample_ingredients: list[str]) -> None:
        """Test parsing a list of ingredients."""
        service = IngredientParserService()
        results = service.parse_ingredients(sample_ingredients)

        assert len(results) == len(sample_ingredients)
        assert all("sentence" in r for r in results)
        assert all("name" in r for r in results)

    def test_parse_ingredients_empty_list(self) -> None:
        """Test parsing empty ingredients list."""
        service = IngredientParserService()

        with pytest.raises(ValueError, match="cannot be empty"):
            service.parse_ingredients([])

    def test_parse_ingredients_not_list(self) -> None:
        """Test parsing with non-list input."""
        service = IngredientParserService()

        with pytest.raises(ValueError, match="must be a list"):
            service.parse_ingredients("not a list")  # type: ignore

    def test_parse_ingredients_with_non_string(self) -> None:
        """Test parsing list containing non-string items."""
        service = IngredientParserService()
        # Should skip non-string items but not fail
        results = service.parse_ingredients(["2 cups flour", 123, "1 tsp salt"])  # type: ignore

        # Should only have 2 results (skipped the number)
        assert len(results) == 2
        assert results[0]["name"] == "flour"

    def test_parse_ingredients_with_empty_strings(self) -> None:
        """Test parsing list with empty strings."""
        service = IngredientParserService()
        # Should skip empty strings
        results = service.parse_ingredients(["2 cups flour", "", "1 tsp salt"])

        assert len(results) == 2

    def test_parse_ingredients_all_valid(self) -> None:
        """Test parsing all valid ingredients."""
        service = IngredientParserService()
        ingredients = [
            "2 cups flour",
            "1 teaspoon salt",
            "3 tablespoons butter",
        ]

        results = service.parse_ingredients(ingredients)

        assert len(results) == 3
        assert results[0]["name"] == "flour"
        assert results[1]["name"] == "salt"
        assert results[2]["name"] == "butter"

    def test_parse_ingredients_with_fractions(self) -> None:
        """Test parsing ingredients with fractional amounts."""
        service = IngredientParserService()
        result = service.parse_single_ingredient("1 1/2 cups sugar")

        assert result["name"] == "sugar"
        assert result["amount"] == "1.5"
        assert result["unit"] == "cup"

    def test_parse_ingredients_without_amount(self) -> None:
        """Test parsing ingredient without amount."""
        service = IngredientParserService()
        result = service.parse_single_ingredient("salt to taste")

        assert "salt" in result["name"]
        # Amount might be None or not present for "to taste"

    def test_parse_ingredients_complex(self) -> None:
        """Test parsing complex ingredient string."""
        service = IngredientParserService()
        result = service.parse_single_ingredient(
            "3 pounds pork shoulder, cut into 2-inch chunks"
        )

        assert "pork" in result["name"]
        assert result["amount"] == "3.0"
        assert "pound" in (result.get("unit") or "")
        assert "cut" in (result.get("preparation") or "")
