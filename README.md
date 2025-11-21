# Ingredients NLP

A production-ready AWS Lambda service for parsing recipe ingredients using NLP. Built with Python 3.12 and the [ingredient-parser](https://github.com/strangetom/ingredient-parser) library.

## Features

- 🧠 **NLP-powered parsing** - Extracts structured data from ingredient strings
- ⚡ **Fast and scalable** - Runs on AWS Lambda
- 🐳 **Docker-based** - Consistent environments for dev and production
- 🔥 **Hot reload** - Fast development with automatic code reloading
- ✅ **Fully tested** - Comprehensive test suite with pytest
- 📝 **Type-safe** - Strict type checking with mypy
- 📊 **Structured logging** - JSON logging for production observability
- 🎯 **Production-ready** - Error handling, validation, and monitoring

## Quick Start

### Prerequisites

- Python 3.12+
- Docker (for containerized development)
- AWS CLI (for deployment)

### Local Development

1. **Clone and setup**:
```bash
git clone <repository-url>
cd ingredients-nlp
cp .env.example .env
```

2. **Install dependencies**:
```bash
make install-dev
```

3. **Run development server**:
```bash
make dev
```

The API will be available at `http://localhost:3000`

### Using Docker

```bash
# Start dev environment with hot reload
make docker-dev

# Stop dev environment
make docker-dev-down
```

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "ingredients-nlp",
  "version": "1.0.0"
}
```

### Parse Ingredients

```bash
POST /parse
Content-Type: application/json

{
  "ingredients": [
    "2 cups all-purpose flour",
    "1 teaspoon salt",
    "3 pounds pork shoulder, cut into 2-inch chunks"
  ]
}
```

Response:
```json
{
  "parsed": [
    {
      "name": "all-purpose flour",
      "amount": "2.0",
      "unit": "cup",
      "preparation": null,
      "sentence": "2 cups all-purpose flour"
    },
    {
      "name": "salt",
      "amount": "1.0",
      "unit": "teaspoon",
      "preparation": null,
      "sentence": "1 teaspoon salt"
    },
    {
      "name": "pork shoulder",
      "amount": "3.0",
      "unit": "pound",
      "preparation": "cut into 2-inch chunks",
      "sentence": "3 pounds pork shoulder, cut into 2-inch chunks"
    }
  ],
  "count": 3
}
```

## Usage Examples

### cURL

```bash
# Health check
curl http://localhost:3000/health

# Parse ingredients
curl -X POST http://localhost:3000/parse \
  -H "Content-Type: application/json" \
  -d '{
    "ingredients": [
      "2 cups flour",
      "1 tsp salt"
    ]
  }'
```

### Python

```python
import requests

# Parse ingredients
response = requests.post(
    "http://localhost:3000/parse",
    json={
        "ingredients": [
            "2 cups flour",
            "1 teaspoon salt",
            "1 large onion, diced"
        ]
    }
)

data = response.json()
for ingredient in data["parsed"]:
    print(f"{ingredient['amount']} {ingredient['unit']} {ingredient['name']}")
```

### JavaScript

```javascript
// Parse ingredients
const response = await fetch('http://localhost:3000/parse', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    ingredients: [
      '2 cups flour',
      '1 teaspoon salt',
      '1 large onion, diced'
    ]
  })
});

const data = await response.json();
console.log(data.parsed);
```

## Development

### Project Structure

```
ingredients-nlp/
├── src/
│   ├── lambda_handler.py         # Main Lambda entry point
│   ├── env.py                    # Configuration
│   ├── types.py                  # Type definitions
│   ├── handlers/                 # Request handlers
│   │   ├── health.py
│   │   └── ingredients.py
│   ├── middleware/               # Request/response utilities
│   │   ├── request.py
│   │   └── response.py
│   ├── services/                 # Business logic
│   │   └── ingredient_parser.py
│   └── utils/                    # Utilities
│       └── logger.py
├── tests/                        # Test suite
├── scripts/                      # Deployment scripts
├── .claude/                      # Claude Code configuration
│   └── skills/                   # Domain-specific guidelines
├── Dockerfile                    # Production image
├── Dockerfile.dev                # Development image
└── docker-compose.dev.yml        # Dev environment
```

### Available Commands

```bash
make help              # Show all available commands
make install-dev       # Install development dependencies
make test              # Run tests with coverage
make lint              # Run linting
make format            # Format code with black
make type-check        # Run type checking
make check-all         # Run all checks
make dev               # Run development server
make docker-dev        # Start Docker dev environment
make docker-build      # Build production Docker image
```

### Running Tests

```bash
# Run all tests
make test

# Run with coverage report
pytest tests/ --cov=src --cov-report=html

# Run specific test file
pytest tests/services/test_ingredient_parser.py -v

# Run tests in watch mode
pytest-watch tests/ -v
```

### Code Quality

```bash
# Format code
make format

# Check formatting
make format-check

# Lint code
make lint

# Type check
make type-check

# Run all checks
make check-all
```

## Deployment

### AWS Lambda

1. **Build and push to ECR**:
```bash
export AWS_ACCOUNT_ID=your-account-id
export AWS_REGION=us-east-1
make push-ecr
```

2. **Create Lambda function** (via AWS Console or IaC):
   - Runtime: Container image
   - Image URI: `{AWS_ACCOUNT_ID}.dkr.ecr.{AWS_REGION}.amazonaws.com/ingredients-nlp:latest`
   - Handler: `src.lambda_handler.handler`
   - Memory: 512 MB (adjust based on load)
   - Timeout: 30 seconds

3. **Configure API Gateway**:
   - Type: HTTP API (API Gateway v2)
   - Integration: Lambda proxy integration
   - Routes: `ANY /{proxy+}`

### Environment Variables

Configure in Lambda:

```
LOG_LEVEL=INFO
ENABLE_DETAILED_LOGGING=false
```

## Configuration

### Environment Variables

- `LOG_LEVEL` - Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- `ENABLE_DETAILED_LOGGING` - Enable JSON structured logging (true/false)
- `DEV_USER_ID` - Development user ID for local testing
- `PORT` - Development server port (default: 3000)

## Error Handling

The API uses standard HTTP status codes:

- `200` - Success
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `405` - Method Not Allowed
- `500` - Internal Server Error

Error response format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

## Performance

- **Cold start**: ~2-3 seconds (first request)
- **Warm requests**: ~50-200ms per ingredient
- **Batch limit**: 100 ingredients per request
- **Recommended concurrency**: 10-50 for optimal performance

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `make test`
4. Run checks: `make check-all`
5. Submit a pull request

## License

MIT

## Resources

- [ingredient-parser documentation](https://ingredient-parser.readthedocs.io/)
- [AWS Lambda Python](https://docs.aws.amazon.com/lambda/latest/dg/lambda-python.html)
- [FastAPI documentation](https://fastapi.tiangolo.com/)

## Support

For issues and questions:
- Open an issue on GitHub
- Check the [ingredient-parser documentation](https://ingredient-parser.readthedocs.io/)

---

Built with ❤️ using Python and NLP
