# Prompt Enhancement Design — All Three Report Types

**Date:** 2026-03-05
**Status:** Approved
**Goal:** Transform report narratives from generic data summaries into premium, deeply researched analyses that feel like a $500 personalized report.

## Problem

Current prompts produce output that is:

1. **Too generic** — could be about any market, doesn't feel personalized
2. **Missing context** — presents numbers without connecting dots between metrics
3. **News-disconnected** — news infrastructure exists but prompts don't instruct the LLM to weave it in naturally
4. **Token-starved** — max_tokens of 100-500 per section (legacy from DeepSeek Chat's 4K limit) forces terse output

## Approach

Same section structure (10 HB, 11 investor, 3 comparison, 3 custom research). Four pillars of improvement:

### Pillar 1: Rich Prompt Engineering

Every text-format section prompt gets:

- **Persona**: "You are a senior real estate analyst at a boutique advisory firm. A client is paying $500 for this market brief. Your reputation depends on delivering insight they can't get from Zillow or Redfin."
- **Anti-patterns** (explicit DO NOT list):
  - "DO NOT just list numbers without interpretation"
  - "DO NOT use generic phrases like 'the market is growing' or 'there's something for everyone'"
  - "DO NOT describe what a metric IS — the reader knows what days on market means. Tell them what THIS number MEANS for THEIR situation"
  - "DO NOT treat all numbers as equally important — lead with what matters most"
- **Good vs bad examples** per section (inline in prompt):
  ```
  BAD: "The median listing price is $425,000, which is a 5.2% increase year-over-year."
  GOOD: "At $425,000, this market has crossed the threshold where a dual-income household earning the metro median of $78,000 would need to stretch beyond the 28% DTI guideline — a shift from just two years ago when the same household qualified comfortably. The 5.2% annual appreciation, while cooling from last year's 8.1%, is still outpacing local wage growth of 3.4%, meaning affordability is quietly eroding even as headlines focus on the 'slowdown.'"
  ```
- **Cross-metric synthesis instructions**: "Connect metrics to each other. If appreciation is high but inventory is rising, explain that tension. If rent growth is strong but cap rates are declining, explain what that means for the investment thesis."
- **Scenario thinking**: Each section includes an instruction like "Include at least one forward-looking insight: 'If [current trend] continues for the next 6-12 months, expect [specific consequence].'"
- **Personalization hooks**: When user data is available (`{{#if user_income}}`), the prompt explicitly says "Frame your analysis through the lens of THIS buyer's situation — their income, their down payment, their timeline. Don't just mention their numbers; show how the market dynamics interact with their specific constraints."

### Pillar 2: Token Limit Unlocking

| Section Type                | Current max_tokens | New max_tokens |
| --------------------------- | ------------------ | -------------- |
| Hero verdict (1 sentence)   | 100                | 150            |
| Score story (2-3 sentences) | 200                | 500            |
| Full narrative sections     | 400                | 2,000          |
| Bottom line / thesis        | 500                | 3,000          |
| Action items (JSON)         | 300                | 500            |
| Watch metrics (JSON)        | 500                | 500            |
| Comparison sections         | 300-400            | 2,000          |

Reasoner model supports up to 64K output tokens. These limits are conservative and leave massive headroom.

Each narrative section prompt adds a minimum quality instruction: "Your response should be 3-5 substantive paragraphs. Each paragraph should contain specific data points AND their implications."

### Pillar 3: News Integration (Woven, Not Appended)

The `enhancePromptWithNews` infrastructure in `claude.service.ts` already filters news by section and appends a `MARKET INTELLIGENCE` block. The missing piece is prompt-level instructions that tell the LLM HOW to use news.

Every section prompt gets a news integration instruction block:

```
## News & Market Intelligence Integration
You will receive a MARKET INTELLIGENCE section with recent local and national news.
Your job is to WEAVE relevant news naturally into your analysis — not as a separate
paragraph, but as supporting evidence for your data-driven points.

Examples of good news integration:
- "The 3.8% rent growth is particularly notable given [Employer X]'s announced
  expansion of 2,000 jobs in the metro, which should sustain rental demand pressure
  through 2027."
- "While the 12-month price forecast projects 4.2% appreciation, the recent approval
  of 3,000 new housing units in [Submarket] could moderate that if deliveries arrive
  on schedule."
- "The stability score of 78 may face headwinds: [Insurance Company] announced a 22%
  rate increase for the region, and the [Climate Event] in Q3 2025 exposed
  vulnerability that wasn't reflected in pre-event pricing."

Rules for news integration:
- Only reference news that genuinely supports or challenges a data point
- Cite the specific development/employer/event — don't say "recent news suggests"
- If national news (Fed policy, mortgage rates) is relevant, connect it to local impact
- If no news is relevant to this section, don't force it — quality > quantity
```

### Pillar 4: Narrative Coherence (Cross-Section Context)

Currently each section is generated in isolation — it only sees its own data. The prompt improvement adds a brief "context window" to each section that summarizes key findings from the overall report:

Add to each section prompt template:

```
## Report Context (for cross-referencing)
- Geography: {{geography_name}} ({{geography_type}})
- Overall Score: {{overall_score}}/100 ({{overall_grade}})
- Strongest component: {{strongest_component}} ({{strongest_score}}/100)
- Weakest component: {{weakest_component}} ({{weakest_score}}/100)
- Key tension: {{key_tension}}
- User goal: {{user_goal_summary}}
```

The `key_tension` and `user_goal_summary` variables need to be computed in the report context builder. `key_tension` is derived from component scores (e.g., "High affordability but weak growth potential" when affordability > 75 and growth < 40). `user_goal_summary` summarizes the user type and top priorities.

## Files to Modify

### Primary target: `packages/backend/src/reports/narrative-prompts.ts`

- All 10 HomeReady section prompts: richer instructions, examples, news integration, cross-section context, increased max_tokens
- All 11 InvestorEdge section prompts: same treatment
- All 3 Comparison prompts: same treatment

### Secondary: `packages/backend/src/reports/claude.service.ts`

- Add `key_tension` computation to context builder
- Add `user_goal_summary` computation
- Increase conversation response max_tokens (currently 1024)
- Update `generateInvestmentAnalysis` max_tokens (currently 600)

### Tertiary: `packages/backend/src/reports/research-brief/research-prompts.ts`

- Already improved — minor tweaks to align with new persona/news patterns

## What Stays the Same

- Section structure (10 HB, 11 investor, 3 comparison, 3 custom research)
- Variable interpolation system (`{{variable}}` and `{{#if}}`)
- Frontend rendering pipeline
- API contracts
- News filtering infrastructure (`SECTION_NEWS_CATEGORIES`, `buildNewsEnhancementForSection`)
- JSON output format sections (actions, watch metrics) — only token limits change

## Implementation Plan

### Step 1: Add shared prompt components

Create reusable prompt blocks (persona, anti-patterns, news integration instructions) as constants that get composed into each section prompt. Avoids duplicating the same 20 lines across 24 prompts.

### Step 2: Enhance HomeReady prompts (10 sections)

Update each section with rich instructions, good/bad examples, cross-section context block, and new max_tokens.

### Step 3: Enhance InvestorEdge prompts (11 sections)

Same treatment, adapted for investor audience.

### Step 4: Enhance Comparison prompts (3 sections)

Same treatment.

### Step 5: Update claude.service.ts

Add context computation (key_tension, user_goal_summary). Update max_tokens for conversation and investment analysis.

### Step 6: Test with live report generation

Generate a HomeReady and InvestorEdge report to verify quality improvement and ensure no rendering breaks.

## Risk Mitigation

- **Longer responses may break frontend rendering**: Unlikely since frontend already handles variable-length markdown. But verify.
- **Higher token usage = higher cost**: DeepSeek Reasoner is cost-effective. Even at 3,000 tokens per section × 10 sections, total output is ~30K tokens per report — well within budget.
- **Prompts getting too long**: Each section prompt will be ~300-500 words (up from ~100-200). With data context, each API call will be ~2-3K tokens input. Reasoner's 128K context handles this easily.
