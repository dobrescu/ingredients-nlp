# Ingredients NLP

AWS Lambda service for parsing recipe ingredients using NLP.

Uses [ingredient-parser-nlp](https://ingredient-parser.readthedocs.io/) - a Python library that uses Conditional Random Fields (CRF) ML model trained on 81,000 recipe ingredient sentences.

## What it extracts

- **Name**: ingredient name
- **Amount**: quantity + max (for ranges like "2-3")
- **Unit**: measurement unit (cups, tsp, etc)
- **Size**: size descriptor (large, small)
- **Preparation**: how to prepare (diced, chopped)
- **Comment**: additional notes
- **Purpose**: intended use (for garnish)
- **Flags**: is_range, is_approximate, is_singular
- **Confidence scores**: ML confidence for each field
- **USDA data**: Foundation Food matches with nutritional info

Example: `"2-3 large tomatoes, diced"` →
```json
{
  "name": "tomatoes",
  "amount": "2.0",
  "amount_max": "3.0",
  "size": "large",
  "preparation": "diced",
  "is_range": true
}
```

## Quick Start

```bash
# Install dev dependencies
pip install -r requirements-dev.txt

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

Response shows parsed ingredients with amounts, units, confidence scores, and USDA nutritional data:
```json
{
  "parsed": [
    {
      "sentence": "2 cups flour",
      "name": "flour",
      "amount": "2.0",
      "unit": "cup",
      "is_range": false,
      "is_approximate": false,
      "confidence": { "name": 0.99, "amount": 1.0 },
      "foundation_foods": [{
        "text": "Flour, white, all-purpose",
        "fdc_id": 169736,
        "url": "https://fdc.nal.usda.gov/food-details/169736/nutrients"
      }]
    }
  ],
  "count": 1
}
```

## Development

```bash
pip install -r requirements-dev.txt   # Install
python scripts/dev_server.py          # Run dev server
pytest tests/                         # Run tests
black src/ tests/                     # Format code
ruff check src/ tests/                # Lint
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
