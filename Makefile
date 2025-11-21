.PHONY: help install test lint format dev

help:
	@echo 'make install  - Install dependencies'
	@echo 'make dev      - Start dev server'
	@echo 'make test     - Run tests'
	@echo 'make lint     - Run linting'
	@echo 'make format   - Format code'

install:
	pip install -r requirements.txt

dev:
	python scripts/dev_server.py

test:
	pytest tests/ -v

lint:
	ruff check src/ tests/

format:
	black src/ tests/ scripts/
