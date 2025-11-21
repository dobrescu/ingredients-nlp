# Testing

## Quick Start

```bash
yarn test              # Run all tests
yarn test:watch        # Watch mode
yarn start:dev         # Dev server on :3000 (auto-auth)
```

---

## Dev Server Testing

Dev server automatically injects auth for local development (`dev-user-local`).

### 1. Load a Recipe

```bash
curl -X POST http://localhost:3000/recipe/load \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.lifeloveandsugar.com/moist-vanilla-layer-cake/"}'
```

Response contains `urlHash`:
```json
{
  "urlHash": "abc123...",
  "recipe": { "name": "Moist Vanilla Layer Cake", ... }
}
```

### 2. Get Recipe (as Kassi would)

```bash
curl http://localhost:3000/recipe/abc123...
```

### 3. Update Recipe (User Edit)

```bash
curl -X PUT http://localhost:3000/recipe/abc123... \
  -H "Content-Type: application/json" \
  -d '{
    "updates": {
      "name": {"value": "My Amazing Vanilla Cake", "rendered": {"type": "markdown", "value": "My Amazing Vanilla Cake", "version": "1.0.0"}}
    }
  }'
```

### 4. Improve Recipe (LLM Enhancement)

```bash
curl -X POST http://localhost:3000/recipe/abc123.../improve
```

---

## SAM Local (Full Lambda Environment)

Requires [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).

```bash
yarn start  # API Gateway simulation on :3000
```

Most realistic testing environment - actual Lambda container with API Gateway emulation.

---

## Automated Tests

```bash
yarn test               # All tests (89 tests)
yarn test:integration   # Integration tests only (28 tests)
yarn test:unit          # Unit tests only
yarn test:watch         # Watch mode
yarn test:coverage      # Coverage report
```

### Test Structure

```
tests/
├── integration/        # Integration tests (28 tests)
│   ├── load-recipe.test.ts       # POST /recipe/load
│   ├── get-recipe.test.ts        # GET /recipe/:urlHash
│   ├── update-recipe.test.ts     # PUT /recipe/:urlHash
│   ├── improve-recipe.test.ts    # POST /recipe/:urlHash/improve
│   ├── multi-user-workflows.test.ts  # Multi-user scenarios
│   └── llm-services.test.ts      # LLM service integration
├── unit/               # Unit tests (9 tests)
└── (src/**/*.test.ts)  # Co-located unit tests (52 tests)
```

### Integration Tests

Integration tests validate complete API flows and service integrations:
- **Load** - Prepper → cache → return
- **Get** - DynamoDB lookup → merge user/baseline → return
- **Update** - Merge changes → detect changed fields → save
- **Improve** - LLM enhancement → merge (tested in llm-services)
- **Multi-User** - User isolation, cache sharing, independent edits

Each test covers:
- Happy path (cache hit/miss)
- Error cases (401, 404, 400)
- Critical edge cases

### Writing Tests

Use **helpers.ts** for test data:

```typescript
import { buildEvent, buildRecipe } from '../helpers.js';

// Create API Gateway event
const event = buildEvent({
  method: 'POST',
  path: '/recipe/load',
  body: { url: 'https://example.com/recipe' }
});

// Create test recipe
const recipe = buildRecipe({
  urlHash: 'abc123',
  url: 'https://example.com/recipe',
  fields: { name: 'Test Recipe' }
});
```

Use **fixtures** for complex data:

```typescript
import prepperFixture from '../fixtures/prepper/valid-recipe-page.json';
import freshRecipe from '../fixtures/recipes/fresh-from-prepper.json';
```

### Mocks

AWS services (DynamoDB, S3, Bedrock) are mocked globally via `tests/setup.ts`.
Individual tests configure specific responses:

```typescript
import { dynamoMock } from '../helpers.js';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

dynamoMock.on(GetCommand).resolves({ Item: testRecipe });
```

### Adding Tests

1. Add fixture files to `tests/fixtures/` if needed
2. Create test file following existing patterns
3. Run `yarn test` to verify

Tests are fast (~3s for all 89 tests) and deterministic (no external dependencies).
