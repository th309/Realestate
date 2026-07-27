# Infographic Topic Library

Source-of-truth documents for generating how-to / use-case / data infographics.
Each topic file contains ONLY verified product facts and approved claims — these
docs are what gets fed to any infographic generator (NotebookLM, image models,
or the deterministic template engine) so generated visuals can't hallucinate
features or numbers. Every fact must be checkable against the codebase or the
canonical claim constants.

## Rules for topic docs

0. **One task per infographic (Troy, 2026-07-26).** Every generated infographic
   covers exactly ONE thing the site can do — one tool, one workflow, one
   question answered. Never bundle multiple tasks onto a single graphic. Topic
   docs may describe a family of tasks, but each generation run targets a
   single task section. Also: never use underscores in user-facing text or
   output filenames — hyphens or spaces.

1. **Feature truth:** every tool, page, button, or workflow described must exist
   in the product today, under the name the product uses. Source product facts
   from `packages/backend/src/admin/analytics/site-context.ts` (the corrected
   product brief) and the live MCP tool list.
2. **Approved numbers only:** coverage and validation figures come from
   `packages/frontend/lib/data/validation-claims.ts` (`COVERAGE_COPY`,
   `V4_CLAIMS`) / `PROPERTYIQ_COVERAGE_STAT`. Never invent or "improve" a number.
3. **Score language:** the PropertyIQ Score is a 1-99 momentum/timing signal,
   50 = state average, higher scores predict outperformance vs the market's
   state. Letters A/B/C/F are data-confidence only, never a score grade.
   Momentum words only (Very Strong / Strong / Rising / Firming / Steady /
   Easing / Weak / Very Weak).
4. **Review gate:** any AI-generated infographic gets a human (Troy) review
   against its topic doc before posting. Image models draw text — they don't
   know it.

## Topics

| File                   | Topic                                       | Audience         | Status      |
| ---------------------- | ------------------------------------------- | ---------------- | ----------- |
| `mcp-for-agents.md`    | What agents can do with the PropertyIQ MCP  | Agents           | Draft ready |
| `how-to-map.md`        | Using the interactive map                   | All              | DRAFT       |
| `how-to-analyzer.md`   | Analyzing a deal by address                 | Investors/Buyers | DRAFT       |
| `how-to-reports.md`    | Building AI market reports                  | All              | DRAFT       |
| `score-explainer.md`   | The 1-99 momentum score, honestly explained | All              | DRAFT       |
| `mcp-for-investors.md` | Investor workflows via MCP                  | Investors        | DRAFT       |
