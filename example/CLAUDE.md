# Claude Code Configuration - Chef API

## Quick Overview

**Chef** is a Lambda-based API for recipe management with LLM-driven improvements. It handles recipe scraping, markdown conversion, storage routing (DynamoDB + S3), and batch field improvements using AWS Bedrock and ChatGPT.

**Tech Stack:**
- Node.js 22.x + TypeScript 5.x (strict mode)
- AWS Lambda (direct API Gateway integration, NO Express)
- DynamoDB, S3, Bedrock
- Firebase Auth (JWT validation)
- Yarn 4.x package manager

---

## Critical Rules

### 1. Type Safety First
- ALWAYS use strict TypeScript mode
- Never use `any` - use `unknown` and type guards instead
- Update type definitions when modifying data structures
- Run `yarn build` frequently to catch type errors early

### 2. Error Handling
- All async operations MUST have try-catch blocks
- Use descriptive error messages with context
- Log errors with relevant metadata (urlHash, firebaseUID, etc.)
- Never swallow errors silently

### 3. AWS Best Practices
- DynamoDB: Use single-table design patterns (see [Database Schema](./docs/solution/03-database-schema.md))
- S3: Store large HTML fragments, not in DynamoDB
- Lambda: Keep functions small and focused
- Use AWS SDK v3 client pattern

### 4. Testing & Validation
- Test all changes locally with `yarn start:dev` before deploying
- Validate LLM responses against expected schemas
- Test authenticated routes with proper Firebase tokens
- Never commit `.env` files

### 5. Code Organization
- Services contain business logic (stateless, pure functions when possible)
- Agents handle LLM communication
- Prompts are versioned and registered in prompt-registry
- Types are centralized in `/src/types`

### 6. Clean Code & Design Patterns
- **NO code duplication** - Extract shared logic to utilities
- **Easy to read** - Prefer clarity over cleverness
- **Design patterns** - Use established patterns (DRY, SOLID principles)
- **Reusable utilities** - Create helpers for repeated operations (e.g., logger utility)
- **Consistent structure** - Follow existing patterns in the codebase

---

## Quick Commands

```bash
# Development
yarn start:dev          # Start dev server with hot reload (tsx watch)
yarn build              # Build with esbuild (catches TypeScript errors)

# Local Lambda testing
yarn start              # SAM local API with warm containers

# Docker
yarn docker:dev         # Docker Compose dev environment
yarn docker:build       # Build Docker image
yarn docker:run         # Run Docker container locally

# Deployment
yarn docker:build-and-deploy  # Build and push to ECR (requires .env)
```

---

## Project Structure

```
src/
├── agents/              # LLM agent implementations
│   ├── bedrock.ts      # AWS Bedrock (Claude 3.5 Sonnet)
│   ├── chatgpt.ts      # OpenAI GPT-4
│   └── chat-agent-factory.ts
├── services/            # Business logic (stateless)
│   ├── recipe-converter.ts      # JSON-LD ↔ Markdown
│   ├── dynamo-service.ts        # DynamoDB operations
│   ├── s3-service.ts            # S3 operations
│   └── html-replacement-service.ts
├── prompts/             # Versioned LLM prompts
│   ├── normalization/   # Recipe normalization
│   ├── recipe-extras/   # Extract additional fields
│   ├── generate-headline/
│   └── prompt-registry.ts
├── types/               # TypeScript type definitions
│   ├── recipe/          # Recipe-specific types
│   └── dynamo.ts, s3.ts
└── utils/               # Shared utilities
```

---

## Key Documentation

**Architecture & Design:**
- [Solution Overview](./docs/solution/01-overview.md) - Core problem, design decisions
- Data Models - TypeScript interfaces (referenced in overview)
- Database Schema - DynamoDB single-table design
- Services - Implementation details

**Development:**
- [README.md](./README.md) - AgentService usage, API examples
- [TESTING.md](./TESTING.md) - Testing strategies (if exists)

---

## Data Flow Quick Reference

### Load Recipe (First Time)
```
User URL → Scrape → JSON-LD → Wrap in ManagedField<T>
         → Hash all fields
         → Save to S3 (raw HTML) + DynamoDB (shared cache)
         → Return ManagedRecipe to client
```

### Improve Recipe (LLM Batch)
```
POST /api/recipe/:urlHash/improve
     → Get recipe from DynamoDB + raw HTML from S3
     → Extract URLs from HTML (minimize tokens)
     → Call 'recipe-extras' prompt
     → Restore URLs in response
     → Merge extras into recipe
     → Update hashes, set modifications.aiModified=true
     → Save to DynamoDB (shared cache if !userModified)
```

---

## Development Workflow

### Starting Large Tasks

When working on a significant feature or refactor:

1. **ALWAYS use planning mode first** - Don't skip this step!
2. **Create task directory:**
   ```bash
   mkdir -p ~/workspace/hautomation/cookbook/api/dev/active/[task-name]/
   ```
3. **Create dev docs:**
   - `[task-name]-plan.md` - The accepted implementation plan
   - `[task-name]-context.md` - Key files, decisions, important context
   - `[task-name]-tasks.md` - Checklist of work items
4. **Update regularly** - Mark tasks complete immediately, add new ones as discovered

### Continuing Tasks

- Check `/dev/active/` for existing tasks before starting work
- Read all three dev docs files before proceeding
- Update "Last Updated" timestamps when modifying files
- Keep context.md updated with important decisions

### Maintaining Dev Docs

**When updating any file:**
- Read the ENTIRE file first
- Remove obsolete information (mark deprecated, don't silently delete)
- Update outdated sections
- Clarify unclear parts
- Verify all links still work
- **BE AGILE** - Keep everything in perfect shape, no information loss

**Before compacting conversation:**
- Update context.md with recent key decisions
- Add rationale for important choices
- Note any gotchas discovered
- Update file references if code moved

---

## Common Patterns

### Working with Agents

```typescript
import { AgentService } from './agent-service.js';

// Create service
const agentService = AgentService.create({
  agent: 'bedrock',           // or 'chatgpt'
  promptType: 'normalization',
  promptVersion: 'v1',
  enableLogging: true
});

// Process recipe
const result = await agentService.processRecipeData(websiteData);
console.log(`Processed in ${result.processingTime}s`);
```

### DynamoDB Queries

```typescript
// Shared cache lookup
PK: recipe#<urlHash>
SK: base

// User record lookup
PK: user#<firebaseUID>
SK: recipe#<urlHash>
```

### Error Handling Pattern

```typescript
import { logger } from './utils/logger/logger.js';

// At Lambda handler boundaries
try {
  const result = await service.operation();
  return json(200, result);
} catch (error) {
  logger.error('Operation failed', { urlHash, firebaseUID, error });
  const message = error instanceof Error ? error.message : String(error);
  return json(500, { error: `Failed to perform operation: ${message}` });
}
```

**Note:** Don't overuse try-catch. Let errors bubble to handler boundaries. See `error-handling-guidelines` skill.

---

## Skills System

Claude Code skills are automatically activated based on your work context. See `.claude/skills/` for:

- `backend-dev-guidelines.md` - API routes, services, DynamoDB patterns
- `llm-integration-guidelines.md` - Working with Bedrock/ChatGPT, prompt engineering
- `recipe-domain-guidelines.md` - Recipe-specific business logic, ManagedField patterns
- `testing-guidelines.md` - Testing strategies, authenticated route testing

Skills auto-activate via hooks (see `.claude/hooks/user-prompt-submit.ts`).

---

## Troubleshooting

### TypeScript Build Errors
```bash
yarn build  # Run this frequently - hooks will catch errors too
```

### Local Lambda Issues
- Ensure Docker is running for SAM local
- Check `.env` file has required AWS credentials
- Verify warm containers are enabled

### DynamoDB Local Testing
- Use `yarn start:dev` for faster iteration (no Lambda overhead)
- Mock DynamoDB/S3 calls if needed for unit tests

---

## Notes

- **Automatic Error Checking**: Hooks run `yarn build` after file edits to catch TypeScript errors immediately
- **Skill Auto-Activation**: Hooks analyze your prompts and inject relevant skills automatically
- **Planning is King**: Always plan before implementing - use planning mode or strategic-plan-architect agent
- **Review Your Code**: Use code-architecture-reviewer agent periodically to catch issues early

---

## Environment Variables

Required in `.env` (never commit this file):
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID` (for local testing)
- `AWS_SECRET_ACCESS_KEY` (for local testing)
- `DYNAMODB_TABLE_NAME`
- `S3_BUCKET_NAME`
- `OPENAI_API_KEY` (if using ChatGPT agent)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

---

**Last Updated:** 2025-11-13
