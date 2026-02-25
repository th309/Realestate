---
name: pr-check
description: Run full PR validation suite (lint, build, tests, code review) before creating a PR
disable-model-invocation: true
---

# PR Validation Check

Run the complete validation suite before creating a pull request. This is your CI gate as a solo developer.

## Workflow

### Step 1: Check Git Status

```bash
git status
git log --oneline main..HEAD  # or develop..HEAD
```

- Verify all changes are committed
- Review the commit history for the branch

### Step 2: Lint Both Packages (parallel)

```bash
# Run in parallel
npm run lint -w backend
npm run lint -w web
```

- Fix any lint errors before proceeding
- Auto-fixable issues should be fixed and committed

### Step 3: Type Check (parallel)

```bash
npx tsc --noEmit -p packages/backend/tsconfig.json
npx tsc --noEmit -p packages/frontend/tsconfig.json
```

- Fix any type errors

### Step 4: Build Both Packages

```bash
npm run build
```

- Both frontend and backend must build cleanly

### Step 5: Run Tests (parallel)

```bash
npm run test -w backend
npm run test:unit -w web
```

- All tests must pass
- Note any skipped tests

### Step 6: Code Review

Dispatch the **code-reviewer** agent to review all changes:

```
git diff main...HEAD  # or develop...HEAD
```

The code-reviewer agent checks:

- CLAUDE.md compliance (data layer, file sizes, naming, security)
- No hardcoded secrets or credentials
- No debug code left in (console.log, debugger, TODO)
- Proper error handling

### Step 7: Report

```markdown
## PR Validation Report

| Check            | Status          | Details     |
| ---------------- | --------------- | ----------- |
| Lint (backend)   | PASS/FAIL       | X issues    |
| Lint (frontend)  | PASS/FAIL       | X issues    |
| Types (backend)  | PASS/FAIL       | X errors    |
| Types (frontend) | PASS/FAIL       | X errors    |
| Build            | PASS/FAIL       | Duration    |
| Tests (backend)  | PASS/FAIL       | X/Y passed  |
| Tests (frontend) | PASS/FAIL       | X/Y passed  |
| Code Review      | APPROVE/CHANGES | See details |

**Verdict:** READY TO MERGE / NEEDS FIXES

### Issues to Fix Before Merge

1. ...

### Commit Summary

- X commits on branch
- Files changed: Y
- Lines added/removed: +A/-B
```

### Step 8: Create PR (if all checks pass)

Only if the user confirms, create the PR with:

- Title summarizing the changes
- Body with the validation report
- Link to any related issues
