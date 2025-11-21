---
name: database-guidelines-dynamodb
description: DynamoDB single-table design, Repository pattern, key schema, and query patterns for Chef API. Use when working with DynamoDB operations, repositories, data modeling, or database access patterns.
---

# Database Guidelines - DynamoDB

## When this skill should be used

Auto-activates when Claude is:

- Writing or modifying repository code that queries/writes DynamoDB
- Designing new data access patterns
- Working on DynamoDB key schemas or table design
- Reviewing or refactoring database operations

Behavioral rules:

- Use Repository pattern (class-based, injectable)
- Let errors bubble - no try-catch in repositories
- No logging in repositories (pure data access layer)
- Follow single-table design with consistent key patterns
- Always use imported `env` for table names

---

## 1. Single-table design

Chef uses one DynamoDB table with two access patterns:

```
Table: chef-recipes

Shared Recipe Cache:
  PK: recipe#<urlHash>
  SK: base

User Recipe Records:
  PK: user#<firebaseUID>
  SK: recipe#<urlHash>
```

Key rules:
- Use literal prefixes: `recipe#`, `user#`, `base`
- Keys are immutable once created
- All items include `PK`, `SK`, timestamps

---

## 2. Repository pattern

### Current implementation (class-based)

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { env } from '../env.js';

export class RecipeRepository {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(tableName?: string) {
    const dynamoClient = new DynamoDBClient({});
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = tableName || env.DYNAMODB_COOKBOOKS;
  }

  async getSharedRecipe(urlHash: string): Promise<StoredRecipe | null> {
    if (!urlHash?.trim()) return null;

    const response = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: {
        PK: `recipe#${urlHash}`,
        SK: 'base'
      }
    }));

    return (response.Item as StoredRecipe) || null;
  }

  async putSharedRecipe(stored: StoredRecipe): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: stored
    }));
  }
}
```

**Key patterns:**
- Constructor injection for testability
- Use `env` import, not `process.env`
- Let errors bubble (no try-catch)
- No logging (pure data access)
- Input validation (trim checks)

---

## 3. Access patterns

### Get shared recipe (baseline)

```typescript
async getSharedRecipe(urlHash: string): Promise<StoredRecipe | null> {
  if (!urlHash?.trim()) return null;

  const response = await this.client.send(new GetCommand({
    TableName: this.tableName,
    Key: {
      PK: `recipe#${urlHash}`,
      SK: 'base'
    }
  }));

  return (response.Item as StoredRecipe) || null;
}
```

### Get user recipe (with customizations)

```typescript
async getUserRecipe(firebaseUID: string, urlHash: string): Promise<StoredRecipe | null> {
  if (!firebaseUID?.trim() || !urlHash?.trim()) return null;

  const response = await this.client.send(new GetCommand({
    TableName: this.tableName,
    Key: {
      PK: `user#${firebaseUID}`,
      SK: `recipe#${urlHash}`
    }
  }));

  return (response.Item as StoredRecipe) || null;
}
```

### Update single field (partial update)

```typescript
async updateUserField(
  firebaseUID: string,
  urlHash: string,
  fieldName: FieldName,
  field: ManagedField<unknown>
): Promise<void> {
  if (!firebaseUID?.trim() || !urlHash?.trim()) {
    throw new Error('firebaseUID and urlHash are required');
  }

  await this.client.send(new UpdateCommand({
    TableName: this.tableName,
    Key: {
      PK: `user#${firebaseUID}`,
      SK: `recipe#${urlHash}`
    },
    UpdateExpression: 'SET #fields.#fieldName = :fieldValue, lastModified = :timestamp',
    ExpressionAttributeNames: {
      '#fields': 'fields',
      '#fieldName': fieldName
    },
    ExpressionAttributeValues: {
      ':fieldValue': JSON.stringify(field),
      ':timestamp': new Date().toISOString()
    }
  }));
}
```

---

## 4. Key patterns reference

| Operation | PK | SK |
|-----------|----|----|
| Shared recipe | `recipe#${urlHash}` | `base` |
| User recipe | `user#${firebaseUID}` | `recipe#${urlHash}` |

---

## 5. Best practices

### Use imported env, not process.env

```typescript
// ❌ BAD
this.tableName = tableName || process.env.DYNAMODB_COOKBOOKS || '';

// ✅ GOOD
import { env } from '../env.js';
this.tableName = tableName || env.DYNAMODB_COOKBOOKS;
```

### Let errors bubble (no try-catch)

```typescript
// ❌ BAD - Over-engineered
async getRecipe(hash: string): Promise<Recipe | null> {
  try {
    const response = await this.client.send(command);
    return response.Item as Recipe;
  } catch (error) {
    logger.error('Failed to get recipe', { error });
    throw error;
  }
}

// ✅ GOOD - Let errors bubble
async getRecipe(hash: string): Promise<Recipe | null> {
  const response = await this.client.send(command);
  return (response.Item as Recipe) || null;
}
```

Why: Errors are caught at service/handler boundaries (see `error-handling-guidelines`).

### No logging in repositories

Repositories are pure data access. Logging belongs in service/handler layer.

### Input validation

```typescript
// ✅ Validate early
if (!urlHash?.trim()) return null;
if (!firebaseUID?.trim() || !urlHash?.trim()) {
  throw new Error('firebaseUID and urlHash are required');
}
```

---

## 6. StoredRecipe structure

```typescript
interface StoredRecipe {
  // Keys
  PK: string;           // recipe#<hash> or user#<uid>
  SK: string;           // base or recipe#<hash>

  // Metadata
  entityType: 'shared_recipe' | 'user_recipe';
  lastModified: string; // ISO timestamp

  // Data
  fields: Record<FieldName, string>; // JSON stringified ManagedField<T>
  urlHash: string;
  originalUrl: string;
  scrapedAt: string;
}
```

---

## 7. Quick reference

### Common DynamoDB operations

```typescript
// Get
await this.client.send(new GetCommand({
  TableName: this.tableName,
  Key: { PK, SK }
}));

// Put
await this.client.send(new PutCommand({
  TableName: this.tableName,
  Item: item
}));

// Update
await this.client.send(new UpdateCommand({
  TableName: this.tableName,
  Key: { PK, SK },
  UpdateExpression: 'SET #field = :value',
  ExpressionAttributeNames: { '#field': 'fieldName' },
  ExpressionAttributeValues: { ':value': value }
}));
```

---

Related skills: `backend-dev-guidelines`, `error-handling-guidelines`

Last updated: 2025-11-20
