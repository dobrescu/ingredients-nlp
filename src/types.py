"""Type definitions for the ingredients NLP service."""

from typing import Any, TypedDict


class FoundationFood(TypedDict):
    """USDA Foundation Food match from ingredient-parser."""

    text: str
    confidence: float
    fdc_id: int
    category: str
    data_type: str
    url: str


class ParsedIngredient(TypedDict, total=False):
    """Parsed ingredient structure returned by ingredient-parser."""

    name: str
    size: str | None
    amount: str | None
    amount_max: str | None
    unit: str | None
    comment: str | None
    preparation: str | None
    purpose: str | None
    is_range: bool
    is_approximate: bool
    is_singular: bool
    sentence: str
    confidence: dict[str, float]
    foundation_foods: list[FoundationFood]


class ParseIngredientsRequest(TypedDict):
    """Request body for parsing ingredients."""

    ingredients: list[str]


class ParseIngredientsResponse(TypedDict):
    """Response body for parsed ingredients."""

    parsed: list[ParsedIngredient]
    count: int


class ErrorResponse(TypedDict):
    """Standard error response structure."""

    error: str
    code: str
    details: dict[str, Any] | None


class HealthResponse(TypedDict):
    """Health check response."""

    status: str
    service: str
    version: str
