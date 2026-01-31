# Quinn DeepSeek Optimization Skill

**Description:** Run iterative optimization tests for Quinn using the DeepSeek-V3/R1 model.

## Overview
This skill wraps the `scripts/quinn-test` suite to specifically validate and optimize DeepSeek's performance as the reasoning engine for Quinn.

## Prerequisites
- Backend must be running (`npm run start:dev` in `packages/backend`)
- `.env` must be configured with `AI_PROVIDER=openai` and `AI_MODEL=deepseek-reasoner` (or `deepseek-chat`)
- `DEEPSEEK_API_KEY` must be set.

## Usage

### 1. Verification Run (Sanity Check)
Run a quick set of default prompts to verify DeepSeek is responding correctly and tools are working.

```bash
npx tsx scripts/quinn-test/run-iterative.ts
```

### 2. DeepSeek Specific Prompts
Run prompts specifically designed to test reasoning and chain-of-thought capabilities.

```bash
npx tsx scripts/quinn-test/run-iterative.ts scripts/quinn-test/prompts.deepseek.txt
```

## files
- `scripts/quinn-test/run-iterative.ts`: Main test runner
- `scripts/quinn-test/prompts.deepseek.txt`: (Create this) specialized prompts
