# Dependencies

**Prerequisites:** All solution documents
**Next:** [Implementation Order](./11-implementation-order.md)

---

## Purpose

This document lists all required npm packages with versions and rationale for the Lightweight Field Envelope solution.

---

## New Dependencies to Add

### Markdown Processing

**ESM Compatibility Note:** Chef runs as Docker container in ESM Lambda. All dependencies must support ESM modules.

#### unified
- **Version:** `^11.0.4`
- **Purpose:** Markdown processing framework
- **Why:** Industry standard for parsing and transforming Markdown, plugin-based architecture
- **Usage:** Parse Markdown to AST for JSON-LD conversion (if needed for user edits)
- **Install:** `npm install unified`
- **ESM:** ✅ Native ESM support

#### remark-parse
- **Version:** `^11.0.0`
- **Purpose:** Markdown → AST parser (unified plugin)
- **Why:** Robust Markdown parser with spec compliance
- **Usage:** Convert Markdown strings to AST for traversal (if needed)
- **Install:** `npm install remark-parse`
- **ESM:** ✅ Native ESM support

#### mdast-util-to-string
- **Version:** `^4.0.0`
- **Purpose:** Extract plain text from Markdown AST nodes
- **Why:** Simple utility for getting text content from AST
- **Usage:** Convert AST nodes to strings when extracting sections (if needed)
- **Install:** `npm install mdast-util-to-string`
- **ESM:** ✅ Native ESM support

#### unist-util-visit
- **Version:** `^5.0.0`
- **Purpose:** Traverse/visit AST nodes
- **Why:** Standard utility for walking AST trees
- **Usage:** Extract sections (headings, lists) from parsed Markdown (if needed)
- **Install:** `npm install unist-util-visit`
- **ESM:** ✅ Native ESM support

### Content Hashing

#### canonical-json
- **Version:** `^2.0.0`
- **Purpose:** Deterministic JSON serialization
- **Why:** Ensures consistent ordering for hash stability (same object → same hash)
- **Usage:** Serialize field values before hashing
- **Install:** `npm install canonical-json`
- **Note:** No `@types` package needed (includes types)
- **ESM:** ✅ Supports ESM

---

## Existing Dependencies (Already in package.json)

### Core Framework
- **express** - API routing (already installed)
- **typescript** - Type safety (already installed)
- **esbuild** - Build tool (already installed)

### AWS SDK
- **@aws-sdk/client-dynamodb** - DynamoDB client (already installed)
- **@aws-sdk/lib-dynamodb** - DynamoDB document client (already installed)
- **@aws-sdk/client-s3** - S3 client (already installed)
- **@aws-sdk/client-bedrock-runtime** - Bedrock LLM client (already installed)

### Firebase
- **firebase-admin** - Firebase Auth validation (already installed)

### LLM (Optional)
- **openai** - OpenAI/ChatGPT client (already installed, optional)

---

## Development Dependencies

### Testing (if not present)

#### jest
- **Version:** `^29.7.0`
- **Purpose:** Testing framework
- **Usage:** Unit and integration tests
- **Install:** `npm install --save-dev jest @types/jest`

#### ts-jest
- **Version:** `^29.1.1`
- **Purpose:** TypeScript preprocessor for Jest
- **Usage:** Run TypeScript tests without separate build
- **Install:** `npm install --save-dev ts-jest`

### Linting (if not present)

#### eslint
- **Version:** `^8.54.0`
- **Purpose:** Code linting
- **Install:** `npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin`

---

## Type Definitions

### Required @types Packages

Most packages include TypeScript definitions, but verify these are present:

```bash
npm install --save-dev @types/node      # Node.js built-ins
npm install --save-dev @types/express   # Express (if missing)
```

**Note:** The Markdown processing libraries (unified, remark-parse, etc.) include their own TypeScript definitions, no `@types/*` packages needed.

---

## Updated package.json

**Direction:** Add these to `dependencies` section:

```json
{
  "dependencies": {
    "canonical-json": "^2.0.0",
    "mdast-util-to-string": "^4.0.0",
    "remark-parse": "^11.0.0",
    "unified": "^11.0.4",
    "unist-util-visit": "^5.0.0"
  }
}
```

---

## Installation Commands

**All at once:**
```bash
npm install unified remark-parse mdast-util-to-string unist-util-visit canonical-json
```

**Verify installation:**
```bash
npm list unified remark-parse mdast-util-to-string unist-util-visit canonical-json
```

---

## Dependency Rationale Summary

| Package | Why This One? | Alternatives Considered |
|---------|---------------|-------------------------|
| **unified** | De facto standard for Markdown processing, plugin ecosystem, TypeScript support | marked (less structured), markdown-it (no plugin system) |
| **remark-parse** | Official unified Markdown parser, spec-compliant | markdown-it, marked (not unified-compatible) |
| **mdast-util-to-string** | Official utility, maintained by unified team | Custom implementation (reinventing wheel) |
| **unist-util-visit** | Official AST traversal, works with all unified formats | Custom tree walker (error-prone) |
| **canonical-json** | RFC 7159 compliant, stable, lightweight | fast-json-stable-stringify (similar, but canonical-json more explicit), custom implementation (unreliable) |

---

## Security Considerations

### Version Pinning

**Recommendation:** Use exact versions in production:
```json
{
  "dependencies": {
    "unified": "11.0.4",  // Exact, no ^
    "canonical-json": "2.0.0"
  }
}
```

**Why:** Prevent unexpected breaking changes in patch versions.

**Trade-off:** Manual updates required for security patches.

**Alternative:** Use `~` for patch updates only:
```json
{
  "dependencies": {
    "unified": "~11.0.4",  // Allows 11.0.x, not 11.1.x
  }
}
```

### Vulnerability Scanning

**Direction:** Run security audit regularly:
```bash
npm audit
npm audit fix  # Apply safe fixes
```

**Set up automated scanning:** Use Dependabot

---

## Bundle Size Impact

**New dependencies size (approximate):**
- unified: ~50 KB
- remark-parse: ~80 KB
- mdast-util-to-string: ~5 KB
- unist-util-visit: ~5 KB
- canonical-json: ~10 KB
- **Total:** ~150 KB (minified)

**Impact:** Minimal for Lambda (< 1% of typical function size).

**Note:** These are server-side only, no client bundle impact.

---

## Node.js Version Requirement

**Minimum Node.js version:** `18.x` (for AWS Lambda compatibility)

**Verify compatibility:**
```bash
node --version  # Should be >= 18.0.0
```

**Package compatibility:**
- unified@11: Requires Node >= 16
- remark-parse@11: Requires Node >= 16
- canonical-json@2: Requires Node >= 12
- **All compatible with Node 18+** ✅

---

## ESM vs CommonJS

**Note:** unified v11+ is ESM-only (no CommonJS).

**Implications:**
- Use `import` syntax (not `require`)
- Set `"type": "module"` in package.json, OR
- Use `.mjs` file extension for ESM modules

**Current project uses:** CommonJS (based on existing code)

**Options:**

**Option A: Convert entire project to ESM**
- Update `package.json`: `"type": "module"`
- Change all `require` → `import`
- Change `module.exports` → `export`

**Option B: Use dynamic import for unified**
```typescript
// In CommonJS file
const processMarkdown = async (markdown: string) => {
  const { unified } = await import('unified');
  const { default: remarkParse } = await import('remark-parse');
  // ... use unified
};
```

**Option C: Use older unified version (not recommended)**
- unified@10 supports CommonJS
- Missing latest features and fixes

**Recommendation:** Option A (convert to ESM) for long-term maintainability.

---

## Workspace Setup

**After installing dependencies:**

1. **Update tsconfig.json** (if using ESM):
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "node",
    "target": "ES2022"
  }
}
```

2. **Update build script** (esbuild):
```json
{
  "scripts": {
    "build": "esbuild src/lambda.ts --bundle --platform=node --target=node18 --format=esm --outfile=dist/lambda.mjs"
  }
}
```

3. **Update Lambda handler** (if using ESM):
- Rename entry file to `.mjs`
- Update Lambda configuration: `Handler: lambda.handler`

---

## Testing Dependencies Setup

**If adding tests (recommended):**

```bash
npm install --save-dev jest ts-jest @types/jest
```

**Create jest.config.js:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  }
};
```

**Add test script to package.json:**
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

---

## Summary

**New packages to install (5 total):**
1. unified - Markdown framework
2. remark-parse - Markdown parser
3. mdast-util-to-string - AST to string
4. unist-util-visit - AST traversal
5. canonical-json - Deterministic JSON

**Installation:**
```bash
npm install unified remark-parse mdast-util-to-string unist-util-visit canonical-json
```

**Total added bundle size:** ~150 KB (negligible for Lambda)

**Breaking change:** unified v11 is ESM-only → requires project migration to ESM or dynamic imports

**Next steps:**
1. Install dependencies
2. Configure ESM if needed
3. Update build process
4. Verify imports work

**Next:** [Implementation Order](./11-implementation-order.md) for phased rollout plan.
