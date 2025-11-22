"""Type definitions for the ingredients NLP service."""

from typing import Any, Dict, List, Optional, TypedDict


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
    size: Optional[str]
    amount: Optional[str]
    amount_max: Optional[str]
    unit: Optional[str]
    comment: Optional[str]
    preparation: Optional[str]
    purpose: Optional[str]
    is_range: bool
    is_approximate: bool
    is_singular: bool
    sentence: str
    confidence: Dict[str, float]
    foundation_foods: List[FoundationFood]


class ParseIngredientsRequest(TypedDict):
    """Request body for parsing ingredients."""

    ingredients: List[str]


class ParseIngredientsResponse(TypedDict):
    """Response body for parsed ingredients."""

    parsed: List[ParsedIngredient]
    count: int


class ErrorResponse(TypedDict):
    """Standard error response structure."""

    error: str
    code: str
    details: Optional[Dict[str, Any]]


class HealthResponse(TypedDict):
    """Health check response."""

    status: str
    service: str
    version: str
