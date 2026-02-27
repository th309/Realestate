# Implement Button Redesign: Copy Prompt to Clipboard

**Date:** 2026-02-26
**Status:** Approved

## Problem

The "Implement" button on AI marketing insight recommendations tries to generate an implementation plan via a backend SSE stream (Claude API -> JSON plan -> ImplementPreview dialog). The flow is broken: the button shows "Planning..." but nothing visible happens.

## Decision

Replace the "Implement" button with a **"Copy" button** that copies a structured prompt (recommendation details + full insight report context) to the clipboard. The user pastes into Claude Code and uses the brainstorming skill there. No new UI components needed.

## User Flow

1. User expands a recommendation, clicks **"Copy"**
2. Structured prompt is copied to clipboard
3. Button briefly shows **"Copied!"** feedback
4. User pastes into Claude Code to brainstorm/implement
5. User can click **"Dismiss"** or mark status as needed

## Prompt Template

```
Use the brainstorming skill to design and implement this recommendation
from a PropertyIQ AI marketing insight report.

## Recommendation
- **Title:** {rec.title}
- **Category:** {rec.category}
- **Priority:** {rec.priority}
- **Action Type:** {rec.action_type}

## Recommendation Details
{rec.content}

## Full Insight Report
{insight.markdown_content}
```

## Changes

### Remove (frontend)

- `useRecommendationExecutor` hook
- `ImplementPreview` component
- All `executor.*` state/callbacks in `AiInsightsPanel`
- `implementingRec` state

### Remove (backend)

- `POST .../recommendations/:recId/plan` endpoint
- `POST .../recommendations/:recId/execute` endpoint
- `RecommendationExecutorService.generatePlanStream()` and `executePlan()` methods

### Keep

- `PUT .../recommendations/:recId` endpoint (status updates)
- Dismiss button behavior

### Add

- `buildImplementPrompt(rec, insightMarkdown)` utility in `utils/`
- Copy button in `RecommendationItem` (replaces Implement button)
- Pass `currentMarkdown` from `AiInsightsPanel` down through props
