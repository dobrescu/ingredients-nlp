# Contributing to Ingredients NLP

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in Issues
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - System information (Python version, OS, etc.)
   - Relevant logs or error messages

### Suggesting Features

1. Check if the feature has been suggested
2. Create a new issue with:
   - Clear description of the feature
   - Use cases and benefits
   - Possible implementation approach
   - Any potential drawbacks

### Pull Requests

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/ingredients-nlp.git
   cd ingredients-nlp
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the code style guidelines
   - Add tests for new functionality
   - Update documentation as needed

4. **Run quality checks**
   ```bash
   make check-all
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` - New features
   - `fix:` - Bug fixes
   - `docs:` - Documentation changes
   - `test:` - Test additions or changes
   - `refactor:` - Code refactoring
   - `style:` - Code style changes
   - `chore:` - Build/tooling changes

6. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

   Then create a Pull Request on GitHub with:
   - Clear description of changes
   - Link to related issues
   - Screenshots (if applicable)
   - Test results

## Development Setup

### Prerequisites
- Python 3.12+
- Docker
- Make

### Setup
```bash
# Clone repository
git clone <repository-url>
cd ingredients-nlp

# Install dependencies
make install-dev

# Run tests
make test

# Start dev server
make dev
```

## Code Style Guidelines

### Python Style

Follow PEP 8 and these guidelines:

1. **Type Hints** - Always use type hints
   ```python
   def parse_ingredient(text: str) -> ParsedIngredient:
       ...
   ```

2. **Docstrings** - Use Google-style docstrings
   ```python
   def parse_ingredients(self, ingredients: List[str]) -> List[ParsedIngredient]:
       """
       Parse a list of ingredient strings.

       Args:
           ingredients: List of ingredient strings

       Returns:
           List of parsed ingredient objects

       Raises:
           ValueError: If ingredients list is empty
       """
   ```

3. **Naming Conventions**
   - Functions/variables: `snake_case`
   - Classes: `PascalCase`
   - Constants: `UPPER_SNAKE_CASE`
   - Private methods: `_leading_underscore`

4. **Imports** - Group and sort imports
   ```python
   # Standard library
   import json
   import os

   # Third-party
   from ingredient_parser import parse_ingredient

   # Local
   from src.types import ParsedIngredient
   ```

### Code Formatting

Use Black for formatting:
```bash
make format
```

### Linting

Use Ruff for linting:
```bash
make lint
```

### Type Checking

Use mypy for type checking:
```bash
make type-check
```

## Testing Guidelines

### Writing Tests

1. **Test file naming**: `test_*.py`
2. **Test function naming**: `test_*`
3. **Test class naming**: `Test*`

Example:
```python
class TestIngredientParser:
    def test_parse_basic_ingredient(self):
        """Test parsing a basic ingredient."""
        service = IngredientParserService()
        result = service.parse_single_ingredient("2 cups flour")

        assert result["name"] == "flour"
        assert result["amount"] == "2.0"
```

### Running Tests

```bash
# All tests
make test

# Specific test file
pytest tests/services/test_ingredient_parser.py -v

# With coverage
pytest tests/ --cov=src --cov-report=html
```

### Test Coverage

- Minimum: 80% overall
- Target: 90% for services
- Critical paths: 100% for handlers

## Documentation

### Code Documentation

- Add docstrings to all public functions and classes
- Include type hints
- Explain complex logic with comments
- Update README for user-facing changes

### Documentation Files

Update relevant documentation:
- `README.md` - Main documentation
- `TESTING.md` - Testing guidelines
- `DEPLOYMENT.md` - Deployment instructions
- `CHANGELOG.md` - Version history

## Commit Guidelines

### Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

### Types
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Code style
- `refactor` - Code refactoring
- `test` - Tests
- `chore` - Build/tooling

### Examples
```
feat(parser): add support for fractional amounts

Add parsing support for fractional ingredient amounts like "1 1/2 cups"

Closes #123
```

## Review Process

### PR Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests added for new functionality
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No linting errors
- [ ] Type checking passes
- [ ] Commit messages are clear
- [ ] No merge conflicts

### Review Timeline

- Initial review: Within 2-3 days
- Follow-up reviews: Within 1-2 days
- Merge: After approval from maintainers

## Questions?

- Open an issue for questions
- Check existing issues and documentation
- Join community discussions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing! 🎉
