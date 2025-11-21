"""
Development server with hot reload.

Wraps the Lambda handler in a FastAPI application for local development.
Mimics API Gateway V2 event structure.
"""

import json
import os
from typing import Any, Dict

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

# Import Lambda handler
from src.lambda_handler import handler as lambda_handler

# Load environment variables
from dotenv import load_dotenv

load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Ingredients NLP API",
    description="Recipe ingredient parser using NLP",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Development user ID
DEV_USER_ID = os.getenv("DEV_USER_ID", "dev-user-local")


def create_lambda_event(request: Request, body: bytes, path: str) -> Dict[str, Any]:
    """
    Create a Lambda event dict from FastAPI request.

    Args:
        request: FastAPI request object
        body: Request body bytes
        path: Request path

    Returns:
        Lambda event dict (API Gateway V2 format)
    """
    return {
        "requestContext": {
            "http": {
                "method": request.method,
                "path": path,
            },
            "authorizer": {
                "jwt": {
                    "claims": {
                        "sub": DEV_USER_ID,
                    },
                },
            },
        },
        "rawPath": path,
        "headers": dict(request.headers),
        "body": body.decode("utf-8") if body else None,
        "queryStringParameters": dict(request.query_params) if request.query_params else None,
    }


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
async def proxy(request: Request, path: str) -> Response:
    """
    Proxy all requests to Lambda handler.

    Args:
        request: FastAPI request
        path: Request path

    Returns:
        FastAPI response
    """
    # Read request body
    body = await request.body()

    # Create Lambda event
    event = create_lambda_event(request, body, f"/{path}")

    # Call Lambda handler
    result = lambda_handler(event)

    # Extract response components
    status_code = result.get("statusCode", 500)
    headers = result.get("headers", {})
    response_body = result.get("body", "")

    # Return response
    return Response(
        content=response_body,
        status_code=status_code,
        headers=headers,
        media_type=headers.get("Content-Type", "application/json"),
    )


@app.get("/")
async def root() -> Dict[str, str]:
    """Root endpoint with API information."""
    return {
        "service": "Ingredients NLP API",
        "version": "1.0.0",
        "endpoints": {
            "health": "GET /health",
            "parse": "POST /parse",
        },
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "3000"))
    print(f"🚀 Dev server starting on http://localhost:{port}")
    print(f"👤 Auth: {DEV_USER_ID}")
    print(f"✨ Hot reload enabled\n")
    print("Available endpoints:")
    print(f"  - GET  http://localhost:{port}/health")
    print(f"  - POST http://localhost:{port}/parse")

    uvicorn.run(
        "scripts.dev_server:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info",
    )
