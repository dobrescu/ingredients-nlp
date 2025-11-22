"""Environment configuration and validation."""

import os
from typing import Literal


class Config:
    """Application configuration from environment variables."""

    # AWS Configuration
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")

    # Logging
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = os.getenv(
        "LOG_LEVEL", "INFO"
    ).upper()  # type: ignore

    # Development
    DEV_USER_ID: str = os.getenv("DEV_USER_ID", "dev-user-local")

    # Feature flags
    ENABLE_DETAILED_LOGGING: bool = os.getenv("ENABLE_DETAILED_LOGGING", "false").lower() == "true"


# Global configuration instance
config = Config()


def validate_config() -> None:
    """Validate required configuration on startup."""
    # Add any required configuration validation here
    if config.LOG_LEVEL not in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
        raise ValueError(f"Invalid LOG_LEVEL: {config.LOG_LEVEL}")


# Validate on module import
validate_config()
