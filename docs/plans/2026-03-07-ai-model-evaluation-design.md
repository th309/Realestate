# AI Model Evaluation Design

**Date:** 2026-03-07
**Goal:** Systematically test AI model options across all 7 purposes to find the best quality-to-cost ratio for production reports.

---

## 1. Models Under Test

| #   | Model               | Provider  | Input / Output (per 1M tokens) | Category           |
| --- | ------------------- | --------- | ------------------------------ | ------------------ |
| 1   | `deepseek-reasoner` | deepseek  | $0.55 / $2.19                  | Baseline (current) |
| 2   | `deepseek-chat`     | deepseek  | $0.27 / $1.10                  | Budget reasoning   |
| 3   | `claude-sonnet-4-6` | anthropic | $3.00 / $15.00                 | Premium            |
| 4   | `claude-haiku-4-5`  | anthropic | $0.80 / $4.00                  | Mid-tier           |
| 5   | `gpt-4.1`           | openai    | $2.00 / $8.00                  | Premium            |
| 6   | `gpt-4.1-mini`      | openai    | $0.40 / $1.60                  | Budget             |
| 7   | `gemini-2.5-flash`  | google    | $0.15 / $0.60                  | Ultra-budget       |

## 2. Test Geographies

| Market                   | ID          | Type              | Why                                            |
| ------------------------ | ----------- | ----------------- | ---------------------------------------------- |
| Tampa-St. Petersburg, FL | metro 45300 | Hot market        | Strong data, clear signals, lots of news       |
| Columbus, OH             | metro 18140 | Stable/boring     | Models must find nuance in unremarkable market |
| Conway, AR               | ZIP 72032   | Data-sparse rural | Tests graceful handling of missing data        |

## 3. Report Types

All 4: HomeReady, InvestorEdge, Comparison (Tampa vs Columbus), Custom

## 4. All 7 Purposes Tested

| Purpose              | How Tested                                   |
| -------------------- | -------------------------------------------- |
| `report_narrative`   | Every report generation (section content)    |
| `report_outline`     | Every report generation (outline pass)       |
| `news_scout`         | Fires during report generation automatically |
| `research_agent`     | Research brief generation                    |
| `research_narrative` | Research brief generation                    |
| `conversation`       | Follow-up questions on generated reports     |
| `custom_report`      | Custom report type                           |

## 5. Phased Test Structure

### Phase 1: Elimination Round (7 reports)

- **Report type:** HomeReady only
- **Geography:** Tampa only (rich data, best showcase)
- **Models:** All 7
- **Goal:** Quick quality read to cut to top 4 models
- **Process:** Change `report_narrative` + `report_outline` model via admin page, generate report, score it

### Phase 2: Deep Comparison (48 reports)

- **Models:** Top 4 from Phase 1
- **Report types:** All 4 (HomeReady, InvestorEdge, Comparison, Custom)
- **Geographies:** All 3 (Tampa, Columbus, Conway)
- **Reports per model:** 12 (4 types x 3 geos)
- **Goal:** Cut to top 2 models for narrative purposes

### Phase 3: Purpose-Specific Testing (top 2-3 models)

- **Conversation:** 3 follow-up questions on Phase 2 reports, swap `conversation` model
- **Research:** Generate research briefs, swap `research_agent` + `research_narrative`
- **News Scout:** Compare news quality captured in Phase 2 reports across models
- **Goal:** Pick final model for each of the 7 purposes (they don't all need to be the same)

### Phase 4: Final Scorecard

- Query `ai_usage_log` to aggregate cost, speed, token usage per model x purpose
- Combine with quality scores from rubric
- Plot cost-vs-quality frontier
- Output: recommended model config for each purpose

### Estimated Totals

- **Reports:** ~60 (7 + 48 + purpose-specific)
- **Cost:** ~$5-15 (funnel prevents burning money on inferior models)

## 6. Scoring Rubric

Each report scored on 6 dimensions (1-5 scale). Cost and speed auto-calculated from usage log.

| Dimension        | Weight | 1 (Poor)                                             | 3 (Adequate)                                           | 5 (Excellent)                                                                                  |
| ---------------- | ------ | ---------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Analytical Depth | 30%    | Generic observations. No insight beyond raw numbers. | Identifies some trends. Occasional "so what?" moments. | Non-obvious insights, connects disparate data, identifies tensions. Reads like a paid analyst. |
| Data Accuracy    | 25%    | Fabricates numbers, contradicts provided data.       | Uses data correctly but may miss nuance.               | Every claim backed by data. Acknowledges gaps honestly.                                        |
| Writing Quality  | 20%    | Robotic, listy, repetitive. Template-like.           | Clear and professional but unremarkable.               | Engaging, varied structure, strong voice. You'd forward it.                                    |
| Cost             | 10%    | >$0.50/report                                        | $0.10-$0.50/report                                     | <$0.10/report                                                                                  |
| Actionability    | 10%    | Vague advice ("consider the market").                | Some specific steps but generic timing.                | Concrete actions with thresholds, timelines, triggers.                                         |
| Speed            | 5%     | >60s generation                                      | 15-60s                                                 | <15s                                                                                           |

**Composite:** `(depth x 0.30) + (accuracy x 0.25) + (writing x 0.20) + (cost x 0.10) + (actionability x 0.10) + (speed x 0.05)`

## 7. Test Execution Workflow

1. Go to Admin > AI Models (`/admin/ai-models`)
2. Switch model for the purpose(s) being tested
3. Set the **Test Run ID** (e.g., `p1-sonnet46-tampa`)
4. Generate a report through the normal UI
5. Read the report and score 4 manual dimensions
6. Repeat with next model

### Test Run ID Convention

`phase{N}-{model-short}-{geography-short}`

Examples: `p1-dsreasoner-tampa`, `p2-sonnet46-columbus`, `p3-conv-haiku45`

## 8. Infrastructure Required

| Component                 | Description                                       |
| ------------------------- | ------------------------------------------------- |
| `ai_usage_log` table      | Stores token counts, cost, duration per AI call   |
| `MODEL_PRICING` constants | Per-model input/output rates for cost calculation |
| `AiProviderService` hook  | Fire-and-forget insert after each completion      |
| `test_run_id` on request  | Optional field to tag calls for evaluation        |
| Admin page field          | Text input for Test Run ID                        |
| Scorecard template        | Markdown doc for manual scoring                   |
| Aggregation query         | SQL to summarize results by test run              |
