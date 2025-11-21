# Quick Start Guide

Get up and running with Ingredients NLP in 5 minutes!

## Prerequisites

- Docker (recommended) OR Python 3.12+
- cURL or any HTTP client

## Option 1: Docker (Recommended)

### Start the service

```bash
# Clone the repository
git clone <repository-url>
cd ingredients-nlp

# Start with Docker Compose (hot reload enabled)
docker compose -f docker-compose.dev.yml up --build
```

The API will be available at `http://localhost:3000`

### Test it works

```bash
# Health check
curl http://localhost:3000/health

# Parse some ingredients
curl -X POST http://localhost:3000/parse \
  -H "Content-Type: application/json" \
  -d '{
    "ingredients": [
      "2 cups flour",
      "1 teaspoon salt",
      "3 tablespoons butter"
    ]
  }'
```

Expected response:
```json
{
  "parsed": [
    {
      "name": "flour",
      "amount": "2.0",
      "unit": "cup",
      "preparation": null,
      "sentence": "2 cups flour"
    },
    ...
  ],
  "count": 3
}
```

## Option 2: Local Python

### Install dependencies

```bash
# Create virtual environment
python3.12 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements-dev.txt
```

### Start the dev server

```bash
# Set environment
export PORT=3000
export LOG_LEVEL=info

# Run dev server
python scripts/dev_server.py
```

Or use Make:
```bash
make dev
```

### Test it

```bash
# Use the same curl commands as above
curl http://localhost:3000/health
```

## What's Next?

### Run example requests

```bash
# Bash examples
bash examples/example_requests.sh

# Python examples
python examples/example_requests.py
```

### Run tests

```bash
# With Docker
docker compose -f docker-compose.dev.yml exec ingredients-nlp-dev pytest tests/

# Locally
make test
```

### View documentation

- [README.md](README.md) - Complete documentation
- [TESTING.md](TESTING.md) - Testing guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [API Documentation](#api-endpoints) - See below

## API Endpoints

### Health Check

**GET** `/health`

Returns service health status.

```bash
curl http://localhost:3000/health
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

**POST** `/parse`

Parse ingredient strings into structured data.

**Request:**
```json
{
  "ingredients": [
    "2 cups flour",
    "1 teaspoon salt"
  ]
}
```

**Response:**
```json
{
  "parsed": [
    {
      "name": "flour",
      "amount": "2.0",
      "unit": "cup",
      "preparation": null,
      "sentence": "2 cups flour"
    },
    {
      "name": "salt",
      "amount": "1.0",
      "unit": "teaspoon",
      "preparation": null,
      "sentence": "1 teaspoon salt"
    }
  ],
  "count": 2
}
```

**Parsed Ingredient Fields:**
- `name` - Ingredient name (e.g., "flour", "chicken breast")
- `amount` - Quantity as string (e.g., "2.0", "1.5")
- `unit` - Unit of measurement (e.g., "cup", "tablespoon", "pound")
- `preparation` - Preparation instructions (e.g., "diced", "minced", "chopped")
- `sentence` - Original ingredient string

**Limits:**
- Maximum 100 ingredients per request
- Ingredients must be non-empty strings

## Common Use Cases

### Parse a Recipe

```bash
curl -X POST http://localhost:3000/parse \
  -H "Content-Type: application/json" \
  -d '{
    "ingredients": [
      "2 cups all-purpose flour",
      "1 teaspoon baking powder",
      "1/2 teaspoon salt",
      "1/2 cup butter, softened",
      "1 cup sugar",
      "2 large eggs",
      "1 teaspoon vanilla extract"
    ]
  }'
```

### Handle Complex Ingredients

```bash
curl -X POST http://localhost:3000/parse \
  -H "Content-Type: application/json" \
  -d '{
    "ingredients": [
      "3 pounds pork shoulder, cut into 2-inch chunks",
      "1 large onion, diced",
      "2-3 cloves garlic, minced"
    ]
  }'
```

## Troubleshooting

### Port already in use

Change the port:
```bash
export PORT=3001
python scripts/dev_server.py
```

### Permission denied

On Linux/Mac, you might need to use `sudo` for Docker:
```bash
sudo docker compose -f docker-compose.dev.yml up
```

### Module not found errors

Make sure you're in the project root and dependencies are installed:
```bash
pip install -r requirements-dev.txt
export PYTHONPATH=$(pwd)
```

### Docker build fails

Clear Docker cache and rebuild:
```bash
docker compose -f docker-compose.dev.yml down
docker system prune -f
docker compose -f docker-compose.dev.yml up --build
```

## Development Commands

```bash
make help              # Show all available commands
make install-dev       # Install dependencies
make test              # Run tests
make lint              # Run linting
make format            # Format code
make dev               # Start dev server
make docker-dev        # Start Docker dev environment
```

## Next Steps

1. **Read the docs**: Check out [README.md](README.md) for complete documentation
2. **Explore the code**: Start with `src/lambda_handler.py`
3. **Run the tests**: `make test` to see the test suite
4. **Deploy to AWS**: Follow [DEPLOYMENT.md](DEPLOYMENT.md)
5. **Contribute**: See [CONTRIBUTING.md](CONTRIBUTING.md)

## Getting Help

- Open an issue on GitHub
- Check existing documentation
- Review example requests

---

Happy parsing! 🎉
