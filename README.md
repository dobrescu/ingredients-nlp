# Ingredients NLP

AWS Lambda service for parsing recipe ingredients using NLP.

## Quick Start

```bash
# Install
pip install -r requirements.txt

# Run locally
python scripts/dev_server.py

# Test
curl http://localhost:3000/health
```

## API

### Parse Ingredients

```bash
POST /parse

{
  "ingredients": ["2 cups flour", "1 tsp salt"]
}
```

Response:
```json
{
  "parsed": [
    {
      "name": "flour",
      "amount": "2.0",
      "unit": "cup",
      "sentence": "2 cups flour"
    }
  ],
  "count": 2
}
```

## Development

```bash
pip install -r requirements.txt    # Install
python scripts/dev_server.py       # Run dev server
pytest tests/                      # Run tests
black src/ tests/                  # Format code
ruff check src/ tests/             # Lint
```

## Project Structure

```
src/
├── lambda_handler.py       # Lambda entry point
├── handlers/               # Request handlers
├── services/               # Business logic
├── middleware/             # Request/response utils
└── utils/                  # Logging

tests/                      # Test suite
scripts/dev_server.py       # Local dev server
```

## Deployment

For AWS Lambda deployment, package the code and deploy to Lambda with API Gateway.
See AWS Lambda documentation for details.
