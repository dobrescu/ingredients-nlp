.PHONY: help install install-dev test lint format type-check clean docker-build docker-run dev

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install production dependencies
	pip install -r requirements.txt

install-dev: ## Install development dependencies
	pip install -r requirements-dev.txt

test: ## Run tests with coverage
	pytest tests/ -v --cov=src --cov-report=term-missing

test-watch: ## Run tests in watch mode
	pytest-watch tests/ -v

lint: ## Run linting (ruff)
	ruff check src/ tests/

lint-fix: ## Run linting with auto-fix
	ruff check --fix src/ tests/

format: ## Format code with black
	black src/ tests/ scripts/

format-check: ## Check code formatting
	black --check src/ tests/ scripts/

type-check: ## Run type checking with mypy
	mypy src/

check-all: format-check lint type-check test ## Run all checks

clean: ## Clean cache files
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache .mypy_cache .coverage htmlcov/ dist/ build/

docker-build: ## Build production Docker image
	docker build -t ingredients-nlp:latest .

docker-run: ## Run production Docker image locally
	docker run -p 9000:8080 ingredients-nlp:latest

docker-dev: ## Start development environment
	docker compose -f docker-compose.dev.yml up --build

docker-dev-down: ## Stop development environment
	docker compose -f docker-compose.dev.yml down

dev: ## Run development server locally
	python scripts/dev_server.py

push-ecr: ## Build and push to ECR (requires AWS_ACCOUNT_ID)
	bash scripts/build-and-push.sh
