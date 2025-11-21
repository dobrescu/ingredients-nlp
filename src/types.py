"""Type definitions for the ingredients NLP service."""

from typing import Any, Dict, List, Optional, TypedDict


class ParsedIngredient(TypedDict, total=False):
    """Parsed ingredient structure returned by ingredient-parser."""

    name: str
    size: Optional[str]
    amount: Optional[str]
    unit: Optional[str]
    comment: Optional[str]
    preparation: Optional[str]
    purpose: Optional[str]
    sentence: str
    confidence: Dict[str, float]


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
