# Quinn Optimization Workflow - Hybrid Testing

## Overview

Hybrid approach: Test locally first (fast iteration), then verify on production.

## Setup

### 1. Configure Local Backend

Your local `.env` is now pointing to **production analytics service**:
```bash
ANALYTICS_SERVICE_URL=https://realestate-production.up.railway.app
```

This means:
- ✅ Local backend has instant hot-reload (~2 seconds)
- ✅ Uses production data from analytics service
- ✅ Test system prompt changes without Railway restarts

### 2. Start Local Backend

```bash
cd packages/backend
npm run start:dev
```

Backend will be available at `http://localhost:3001`

## Optimization Workflow

### Phase 1: Local Testing & Iteration (Fast Loop)

```bash
# Run optimizer against local backend
npx tsx scripts/quinn-test/optimize-prompts.ts scripts/quinn-test/comprehensive-prompts.txt --url http://localhost:3001
```

**When a test fails:**

1. **Analyze the failure** - Check the output for:
   - What tool was called
   - What arguments were used
   - What the response was
   - Why it scored low

2. **Fix the system prompt** - Edit one of:
   - `packages/backend/src/analytics-chat/quinn-system-prompt.ts` (Claude)
   - `packages/backend/src/analytics-chat/quinn-deepseek-system-prompt.ts` (DeepSeek)

3. **Wait for hot reload** (~2 seconds) - The backend automatically restarts

4. **Rerun the failed test**:
   ```bash
   npx tsx scripts/quinn-test/optimize-prompts.ts scripts/quinn-test/comprehensive-prompts.txt --url http://localhost:3001 --resume <failed_index>
   ```

5. **Repeat** until the test passes with score ≥ 95

6. **Continue** to the next test

### Phase 2: Production Verification (Slow but Definitive)

Once all tests pass locally:

1. **Commit all changes**:
   ```bash
   git add packages/backend/src/analytics-chat/*.ts
   git commit -m "feat(quinn): optimize prompts for comprehensive test suite"
   git push
   ```

2. **Wait for Railway deployment** (~5-7 minutes)

3. **Run full suite against production**:
   ```bash
   npx tsx scripts/quinn-test/optimize-prompts.ts scripts/quinn-test/comprehensive-prompts.txt --url https://backend-production-ee4d.up.railway.app
   ```

4. **If any tests fail on production** (but passed locally):
   - Investigate production-specific issues (different AI provider, caching, etc.)
   - Fix and repeat

## Tips

### Batch Similar Fixes

If you notice multiple tests failing for the same reason, fix them all at once before rerunning.

### Use Resume Flag

Always use `--resume <index>` to skip tests that already passed:
```bash
# If test #15 failed, resume from there
npx tsx scripts/quinn-test/optimize-prompts.ts scripts/quinn-test/comprehensive-prompts.txt --url http://localhost:3001 --resume 14
```

### Switch AI Providers Locally

Test with different providers by changing `.env`:
```bash
# Test with DeepSeek locally
AI_PROVIDER=deepseek
AI_MODEL=deepseek-chat

# Test with Claude locally
AI_PROVIDER=anthropic
AI_MODEL=claude-sonnet-4-5-20250929
```

### Monitor Logs

Watch the backend logs for detailed tool execution:
```bash
# In the terminal running npm run start:dev
# Look for:
# - [Quinn Intent] Detected: <intent>
# - [OpenAIProvider] Executing tool: <tool_name> with args: <args>
# - [AnalyticsToolsService] Response status: <status>
```

## Expected Timeline

- **Local iteration**: 2-3 seconds per fix/retest cycle
- **Full local suite**: ~30-40 minutes (76 tests)
- **Production verification**: 5-7 min deploy + 30-40 min tests
- **Total**: ~1.5-2 hours for full optimization

## Success Criteria

- ✅ All 76 tests pass locally with score ≥ 95
- ✅ All 76 tests pass on production with score ≥ 95
- ✅ No critical failures (hallucinations, wrong data, incomplete responses)
