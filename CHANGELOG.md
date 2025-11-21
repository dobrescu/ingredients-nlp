# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-21

### Added
- Initial release of Ingredients NLP service
- POST /parse endpoint for parsing ingredient strings
- GET /health endpoint for health checks
- AWS Lambda support with container images
- Docker-based development environment with hot reload
- Comprehensive test suite with pytest
- Type checking with mypy
- Code formatting with Black
- Linting with Ruff
- Structured logging with JSON output
- Error handling and validation
- Claude Code skills for development guidelines
- Complete documentation (README, TESTING, DEPLOYMENT)
- Example requests in Python and Bash
- GitHub Actions CI/CD pipeline
- Makefile for common development tasks

### Features
- NLP-powered ingredient parsing using ingredient-parser library
- Batch processing up to 100 ingredients per request
- Graceful error handling with fallback values
- CORS support for web applications
- Production-ready logging and monitoring
- CloudWatch integration for AWS deployments

### Developer Experience
- Hot reload development server
- Docker Compose for local development
- Comprehensive test coverage
- Type-safe Python code
- Automated code quality checks
- Clear project structure and organization

## [Unreleased]

### Planned
- Caching layer for frequently parsed ingredients
- Rate limiting and throttling
- Metrics and analytics endpoint
- Batch async processing
- GraphQL API option
- Multi-language support
- Custom training data support
