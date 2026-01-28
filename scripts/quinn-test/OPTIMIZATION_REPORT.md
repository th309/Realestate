# Quinn Full Optimizer Workflow Report

Generated: 2025-01-27

## Executive Summary

- **Baseline run**: 57 prompts, 100% API success (Railway backend), **8.8% quality pass rate** (5/57).
- **Main failure drivers**: Response length (brevity 16.7), data repetition in text (22.8), and 10 critical failures (hallucination, no data, wrong scoring).
- **Iteration 1 applied**: Stronger “1–3 sentences max” and “never list data in text” rules in `QUINN_BASE_SYSTEM_PROMPT`.
- **How to run iteration 2**: Use a backend that has these changes (local or after deploy), then re-run tests and evaluator.

---

## 1. Baseline Results

| Metric | Value |
|--------|--------|
| Backend | Railway (https://backend-production-ee4d.up.railway.app) |
| Prompts | 57 (comprehensive-prompts.txt) |
| API success | 57/57 (100%) |
| **Quality pass rate** | **5/57 (8.8%)** |
| Critical failures | 10 |
| Avg response time | 9,094 ms |
| Avg tool calls | 1.5 |

---

## 2. Quality Evaluation Summary

| Score (0–100) | Baseline |
|---------------|----------|
| Brevity | 16.7 |
| Data repetition | 22.8 |
| Markdown | 85.1 |
| Tool mention | 97.4 |
| Intent match | 80.7 |
| Completeness | 94.0 |
| Duration | (within targets for most) |

**Pass definition**: overall ≥ 80 and no critical failure (no data when needed, wrong scoring system, hallucination, incomplete answer, data omission).

---

## 3. Failure Patterns (by frequency)

1. **Response too long** – Almost every failure. Target is 1–3 sentences; many replies were 4+ sentences or paragraphs.
2. **Data repeated in text** – Quinn often listed “Top markets: 1. X (score), 2. Y (score)…” instead of one line and letting the UI show the table.
3. **Contains markdown** – Some answers used `**`, `##`, or bullets.
4. **Wrong tools for intent** – e.g. “Compare Austin to Nashville”, “Show me backtest results”, “Show me historical data for Miami”, “What raw metrics predict appreciation”, “Show me Zillow data for Austin”, “Compare Census data across metros”, “Filter for positive cash flow markets”.
5. **CRITICAL: Hallucinated data** – Numbers in the reply not present in `structuredData` (e.g. “58.48”, “4.2%”) in some trend/validation answers.
6. **CRITICAL: No data when needed / Wrong scoring** – “Filter for positive cash flow markets” (no data returned, wrong scoring system).

---

## 4. Iteration 1: Fixes Applied

### 4.1 System prompt (`quinn-system-prompt.ts`)

**File**: `packages/backend/src/analytics-chat/quinn-system-prompt.ts`

**Updates in “CRITICAL RESPONSE FORMATTING RULES”**:

- **Length**: Explicit “1–3 sentences MAXIMUM. One intro sentence is ideal. Longer responses fail.”
- **No listing data**:  
  - “NEVER list data in your reply”  
  - “Do NOT write ‘Top markets: 1. Austin (95), 2. Nashville (92)...’”  
  - “Do NOT include ranking lists, scores, or metro/county names in your text”  
  - “The UI renders the table from tool results. Your job: one short sentence, then stop.”  
  - Added a wrong example: “Top markets:” then “1. Amarillo (74.8), 2. Bynum (74.5)...”
- **Markdown**: Kept “NEVER use markdown” and “Plain text only”.
- **When tools return data**: “Say one brief context sentence and stop. Do not summarize or repeat the table.”

**Goal**: Raise brevity and data-repetition scores and reduce “response too long” and “data repeated in text” failures.

---

## 5. How to Run Iteration 2

Iteration 2 must run against a backend that includes the Iteration 1 prompt changes (either local or after you deploy).

### Option A: Local backend

1. From repo root, start the backend:
   ```bash
   npm run dev:backend
   ```
2. When it’s up (e.g. “Nest application successfully started”), in another terminal:
   ```bash
   npx tsx scripts/quinn-test/run-iterative.ts scripts/quinn-test/comprehensive-prompts.txt --output scripts/quinn-test/iter1-results.json --url http://localhost:3001
   ```
3. Run the evaluator:
   ```bash
   npx tsx scripts/quinn-test/evaluate-responses.ts scripts/quinn-test/iter1-results.json
   ```
4. Compare `iter1-results-evaluations.json` to `baseline-results-evaluations.json` (pass rate, brevity, data-repetition).

### Option B: After deploy to Railway

1. Deploy the branch that contains the prompt changes.
2. Run the test script without `--url` (so it uses the default Railway URL):
   ```bash
   npx tsx scripts/quinn-test/run-iterative.ts scripts/quinn-test/comprehensive-prompts.txt --output scripts/quinn-test/iter1-results.json
   ```
3. Run the evaluator as in step 3 above.

### Stopping / success criteria

- **Success**: Quality pass rate ≥ 95% with no critical failures.
- **Plateau**: No improvement for 3 consecutive iterations.
- **Max iterations**: 20 (per skill).

---

## 6. Suggested Next Iterations

- **Iteration 2**: Re-run after Iteration 1 (as above) and confirm brevity/data-repetition improve; fix any new or remaining issues.
- **Intent/tools**: If “wrong tools for intent” persists, adjust `getQueryIntent()` / `getRelevantTools()` in `analytics-chat.service.ts` for:
  - “Compare [A] to [B]” (e.g. Austin vs Nashville) → ensure compare/benchmark or two get_rankings + synthesize.
  - “Show me backtest results” / “How accurate is InvestorEdge?” → `run_backtest` (or equivalent).
  - “Show me historical data for Miami” → `get_time_series`.
  - “What raw metrics predict appreciation?” → `analyze_raw_metrics` (or relevant raw-metrics tool).
  - “Show me Zillow data for Austin” → `query_database_table` (or Zillow-specific path).
  - “Filter for positive cash flow markets” → investor tools and `investoredge_score` (and ensure a ranking/filter tool is used so data is returned).
- **Hallucination**: If “hallucinated data” continues, add a short, explicit rule: “Only use numbers and percentages that appear in the tool results. Do not infer or invent figures.”
- **Markdown**: If markdown still appears, add 1–2 “❌ WRONG” examples showing `**bold**` and `## Header` and state that such answers fail checks.

---

## 7. Artifacts

| Artifact | Path |
|----------|------|
| Comprehensive prompts | `scripts/quinn-test/comprehensive-prompts.txt` |
| Baseline results (API) | `scripts/quinn-test/baseline-results.json` |
| Baseline evaluations | `scripts/quinn-test/baseline-results-evaluations.json` |
| Test runner (with `--output`) | `scripts/quinn-test/run-iterative.ts` |
| Evaluator | `scripts/quinn-test/evaluate-responses.ts` |

---

## 8. Commands Reference

```bash
# Run tests (default Railway), write JSON for evaluator
npx tsx scripts/quinn-test/run-iterative.ts scripts/quinn-test/comprehensive-prompts.txt --output scripts/quinn-test/baseline-results.json

# Run against local backend
npx tsx scripts/quinn-test/run-iterative.ts scripts/quinn-test/comprehensive-prompts.txt --output scripts/quinn-test/iter1-results.json --url http://localhost:3001

# Evaluate quality
npx tsx scripts/quinn-test/evaluate-responses.ts scripts/quinn-test/baseline-results.json
```

Exit codes: test script — 0 if all API calls succeed, 1 otherwise; evaluator — 0 if quality pass rate ≥ 95%, 1 otherwise.
