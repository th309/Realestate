# AI Model Evaluation Scorecard

Reference: [Design Doc](./2026-03-07-ai-model-evaluation-design.md)

---

## Scoring Guide

Rate each dimension 1-5. Cost and Speed are auto-calculated from `ai_usage_log`.

| Score | Meaning                                    |
| ----- | ------------------------------------------ |
| 5     | Excellent — exceeds expectations           |
| 4     | Good — solid, minor room for improvement   |
| 3     | Adequate — meets baseline, nothing special |
| 2     | Below average — notable weaknesses         |
| 1     | Poor — fails expectations                  |

---

## Phase 1: Elimination Round

**Geography:** Tampa-St. Petersburg, FL (metro 45300)
**Report type:** HomeReady

| Test Run ID         | Model             | Depth (30%) | Accuracy (25%) | Writing (20%) | Actionability (10%) | Notes    |
| ------------------- | ----------------- | ----------- | -------------- | ------------- | ------------------- | -------- |
| p1-dsreasoner-tampa | deepseek-reasoner |             |                |               |                     | Baseline |
| p1-dschat-tampa     | deepseek-chat     |             |                |               |                     |          |
| p1-sonnet46-tampa   | claude-sonnet-4-6 |             |                |               |                     |          |
| p1-haiku45-tampa    | claude-haiku-4-5  |             |                |               |                     |          |
| p1-gpt41-tampa      | gpt-4.1           |             |                |               |                     |          |
| p1-gpt41mini-tampa  | gpt-4.1-mini      |             |                |               |                     |          |
| p1-gemflash-tampa   | gemini-2.5-flash  |             |                |               |                     |          |

**Phase 1 Result:** Top 4 advancing → ******\_\_\_\_******

---

## Phase 2: Deep Comparison

**Models:** (fill in top 4 from Phase 1)

### Model A: ******\_\_\_******

| Test Run ID | Report Type  | Geography         | Depth | Accuracy | Writing | Actionability | Notes |
| ----------- | ------------ | ----------------- | ----- | -------- | ------- | ------------- | ----- |
|             | HomeReady    | Tampa             |       |          |         |               |       |
|             | HomeReady    | Columbus          |       |          |         |               |       |
|             | HomeReady    | Conway ZIP        |       |          |         |               |       |
|             | InvestorEdge | Tampa             |       |          |         |               |       |
|             | InvestorEdge | Columbus          |       |          |         |               |       |
|             | InvestorEdge | Conway ZIP        |       |          |         |               |       |
|             | Comparison   | Tampa vs Columbus |       |          |         |               |       |
|             | Comparison   | Columbus          |       |          |         |               |       |
|             | Comparison   | Conway ZIP        |       |          |         |               |       |
|             | Custom       | Tampa             |       |          |         |               |       |
|             | Custom       | Columbus          |       |          |         |               |       |
|             | Custom       | Conway ZIP        |       |          |         |               |       |

### Model B: ******\_\_\_******

| Test Run ID | Report Type  | Geography         | Depth | Accuracy | Writing | Actionability | Notes |
| ----------- | ------------ | ----------------- | ----- | -------- | ------- | ------------- | ----- |
|             | HomeReady    | Tampa             |       |          |         |               |       |
|             | HomeReady    | Columbus          |       |          |         |               |       |
|             | HomeReady    | Conway ZIP        |       |          |         |               |       |
|             | InvestorEdge | Tampa             |       |          |         |               |       |
|             | InvestorEdge | Columbus          |       |          |         |               |       |
|             | InvestorEdge | Conway ZIP        |       |          |         |               |       |
|             | Comparison   | Tampa vs Columbus |       |          |         |               |       |
|             | Comparison   | Columbus          |       |          |         |               |       |
|             | Comparison   | Conway ZIP        |       |          |         |               |       |
|             | Custom       | Tampa             |       |          |         |               |       |
|             | Custom       | Columbus          |       |          |         |               |       |
|             | Custom       | Conway ZIP        |       |          |         |               |       |

### Model C: ******\_\_\_******

(Copy table structure from above)

### Model D: ******\_\_\_******

(Copy table structure from above)

**Phase 2 Result:** Top 2 advancing → ******\_\_\_\_******

---

## Phase 3: Purpose-Specific Testing

### Conversation Quality (purpose: `conversation`)

| Test Run ID | Model | Report Used | Question | Depth | Accuracy | Writing | Notes |
| ----------- | ----- | ----------- | -------- | ----- | -------- | ------- | ----- |
|             |       |             | Q1:      |       |          |         |       |
|             |       |             | Q2:      |       |          |         |       |
|             |       |             | Q3:      |       |          |         |       |

### Research Briefs (purposes: `research_agent` + `research_narrative`)

| Test Run ID | Model | Geography | Depth | Accuracy | Writing | Notes |
| ----------- | ----- | --------- | ----- | -------- | ------- | ----- |
|             |       | Tampa     |       |          |         |       |
|             |       | Columbus  |       |          |         |       |

### News Scout Quality (purpose: `news_scout`)

| Test Run ID | Model | Geography | Relevance (1-5) | Recency (1-5) | Notes |
| ----------- | ----- | --------- | --------------- | ------------- | ----- |
|             |       | Tampa     |                 |               |       |
|             |       | Columbus  |                 |               |       |

---

## Phase 4: Final Results

### Cost Summary (from ai_usage_log query)

| Model | Avg Cost/Report | Avg Duration | Avg Tokens | Reports Generated |
| ----- | --------------- | ------------ | ---------- | ----------------- |
|       |                 |              |            |                   |

### Composite Scores

| Model | Depth (30%) | Accuracy (25%) | Writing (20%) | Cost (10%) | Action (10%) | Speed (5%) | **Composite** |
| ----- | ----------- | -------------- | ------------- | ---------- | ------------ | ---------- | ------------- |
|       |             |                |               |            |              |            |               |

### Final Recommendation

| Purpose              | Recommended Model | Rationale |
| -------------------- | ----------------- | --------- |
| `report_narrative`   |                   |           |
| `report_outline`     |                   |           |
| `custom_report`      |                   |           |
| `research_agent`     |                   |           |
| `research_narrative` |                   |           |
| `news_scout`         |                   |           |
| `conversation`       |                   |           |
