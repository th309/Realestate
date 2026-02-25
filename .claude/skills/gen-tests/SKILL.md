---
name: gen-tests
description: Generate unit tests for a specified file using project test patterns
disable-model-invocation: true
---

# Generate Tests

Generate comprehensive unit tests for a specified source file, following existing test patterns in the codebase.

## Input

The user provides a file path (or describes which file/feature to test).

## Workflow

### Step 1: Analyze the Target File

Read the file and identify:

- All exported functions, classes, components, and hooks
- Dependencies that need mocking (Supabase, Redis, external APIs)
- Edge cases (null/undefined inputs, empty arrays, error states)

### Step 2: Determine Test Framework

| Package              | Framework                | Config                 | Command             |
| -------------------- | ------------------------ | ---------------------- | ------------------- |
| `packages/frontend/` | Vitest + Testing Library | `vitest.config.ts`     | `npm run test:unit` |
| `packages/backend/`  | Jest                     | `jest` in package.json | `npm run test`      |

### Step 3: Find Existing Test Patterns

Search for existing tests in the same package to match style:

```
Glob: packages/{frontend,backend}/**/*.{test,spec}.{ts,tsx}
```

Read 2-3 existing test files to match:

- Import style
- Mock patterns (how Supabase, Redis, fetch are mocked)
- Describe/it structure
- Assertion patterns

### Step 4: Generate Tests

For **React components** (.tsx):

- Render test (does it render without crashing?)
- Props test (does it display correct data for given props?)
- Loading state test
- Error state test
- User interaction tests (clicks, form submissions)
- Conditional rendering tests

For **hooks**:

- Setup with `renderHook` from Testing Library
- Mock API responses
- Test loading/success/error states
- Test data transformations
- Test cache behavior (React Query)

For **services** (NestJS):

- Constructor/DI test
- Method return values with mocked dependencies
- Error handling (what happens when Supabase query fails?)
- Edge cases (empty results, null values)

For **utility functions**:

- Happy path for each function
- Edge cases (empty string, 0, null, undefined, NaN)
- Boundary values
- Type edge cases

### Step 5: Write Test File

Place the test file adjacent to the source:

- Frontend: `ComponentName.test.tsx` or `hookName.test.ts`
- Backend: `service-name.spec.ts`

### Step 6: Run Tests

```bash
# Frontend
npm run test:unit -w web -- path/to/file.test.ts

# Backend
npm run test -w backend -- --testPathPattern=path/to/file.spec.ts
```

Fix any failures before completing.

## Test Quality Rules

- Each `describe` block tests ONE function/component
- Each `it` block tests ONE behavior
- Test descriptions read as sentences: `it('returns formatted currency for positive values')`
- No magic numbers — use named constants
- Mock at the boundary (Supabase client, fetch), not internal functions
- Test behavior, not implementation details
