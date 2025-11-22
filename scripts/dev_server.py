"""Simple dev server that wraps the Lambda handler."""

import os
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from src.lambda_handler import handler as lambda_handler

load_dotenv()

app = FastAPI(title="Ingredients NLP API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.api_route("/{path:path}", methods=["GET", "POST", "OPTIONS"])
async def proxy(request: Request, path: str) -> Response:
    """Proxy requests to Lambda handler."""
    body = await request.body()

    event: Dict[str, Any] = {
        "requestContext": {"http": {"method": request.method, "path": f"/{path}"}},
        "body": body.decode("utf-8") if body else None,
    }

    result = lambda_handler(event)
    return Response(
        content=result.get("body", ""),
        status_code=result.get("statusCode", 500),
        headers=result.get("headers", {}),
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "3000"))
    print(f"🚀 http://localhost:{port}")
    uvicorn.run("scripts.dev_server:app", host="0.0.0.0", port=port, reload=True)
