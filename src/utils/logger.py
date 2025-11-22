"""Structured logging utility."""

import json
import logging
import sys
from typing import Any

from src.env import config


class StructuredLogger:
    """Structured logger for JSON output in production."""

    def __init__(self, name: str = "ingredients-nlp") -> None:
        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, config.LOG_LEVEL))

        # Remove existing handlers
        self.logger.handlers.clear()

        # Add console handler
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(getattr(logging, config.LOG_LEVEL))

        # Use JSON formatter for structured logging
        if config.ENABLE_DETAILED_LOGGING:
            formatter = logging.Formatter(
                '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}'
            )
        else:
            formatter = logging.Formatter("%(levelname)s: %(message)s")

        handler.setFormatter(formatter)
        self.logger.addHandler(handler)

    def _log(
        self, level: str, message: str, context: dict[str, Any] | None = None
    ) -> None:
        """Internal logging method with context."""
        if context:
            # Sanitize context - convert non-serializable objects
            sanitized = self._sanitize_context(context)
            log_message = f"{message} | {json.dumps(sanitized)}"
        else:
            log_message = message

        getattr(self.logger, level)(log_message)

    def _sanitize_context(self, context: dict[str, Any]) -> dict[str, Any]:
        """Sanitize context for JSON serialization."""
        sanitized: dict[str, Any] = {}
        for key, value in context.items():
            if isinstance(value, (str, int, float, bool, type(None))):
                sanitized[key] = value
            elif isinstance(value, (list, tuple)):
                sanitized[key] = [str(v) for v in value]
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_context(value)
            elif isinstance(value, Exception):
                sanitized[key] = {
                    "type": type(value).__name__,
                    "message": str(value),
                }
            else:
                sanitized[key] = str(value)
        return sanitized

    def info(self, message: str, context: dict[str, Any] | None = None) -> None:
        """Log info message."""
        self._log("info", message, context)

    def warning(self, message: str, context: dict[str, Any] | None = None) -> None:
        """Log warning message."""
        self._log("warning", message, context)

    def error(self, message: str, context: dict[str, Any] | None = None) -> None:
        """Log error message."""
        self._log("error", message, context)

    def debug(self, message: str, context: dict[str, Any] | None = None) -> None:
        """Log debug message."""
        self._log("debug", message, context)


# Global logger instance
logger = StructuredLogger()
