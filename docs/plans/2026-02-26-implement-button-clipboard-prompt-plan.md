# Implement Button → Copy Prompt to Clipboard Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken AI plan generation "Implement" button with a simple "Copy" button that copies a structured prompt to clipboard for use in Claude Code.

**Architecture:** Remove the entire SSE plan generation + execution pipeline (frontend hook, modal, backend endpoints). Replace with a pure-frontend utility that builds a structured prompt from recommendation + insight data, copies it to clipboard, and shows brief "Copied!" feedback on the button.

**Tech Stack:** React (useState), Clipboard API (`navigator.clipboard.writeText`), no backend changes beyond cleanup.

---

### Task 1: Fix RecommendationItem — Replace Implement with Copy Button

**Files:**

- Modify: `packages/frontend/app/admin/entitlements/analytics/components/RecommendationItem.tsx`

**Note:** The interface was already partially updated (props use `onCopyPrompt`) but the destructured params and JSX still reference the old `onImplement`/`implementLoading`. Fix the mismatch and add clipboard "Copied!" feedback.

**Step 1: Update the component**

Replace the full component (lines 49-143) with:

```tsx
export function RecommendationItem({
  recommendation: rec,
  onCopyPrompt,
  onDismiss,
}: RecommendationItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const ActionIcon = ACTION_ICONS[rec.action_type];

  const handleCopy = () => {
    if (onCopyPrompt) {
      onCopyPrompt();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border border-outline-variant/50 rounded-lg bg-surface overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start gap-2 p-3 hover:bg-surface-container-low/50 transition-colors text-left"
      >
        <span
          className={`px-1.5 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 mt-0.5 ${PRIORITY_STYLES[rec.priority]}`}
        >
          {rec.priority}
        </span>
        <h5 className="text-sm font-medium text-on-surface flex-1">
          {rec.title}
        </h5>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 text-xs text-on-surface-variant">
            <ActionIcon className="w-3.5 h-3.5" />
            <span>{ACTION_LABELS[rec.action_type]}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-on-surface-variant" />
          ) : (
            <ChevronRight className="w-4 h-4 text-on-surface-variant" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 border-t border-outline-variant/30">
          <div
            className="text-sm text-on-surface-variant leading-relaxed mt-3 mb-3 prose prose-sm dark:prose-invert max-w-none [&_strong]:text-on-surface [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1 [&_ol]:pl-4 [&_ul]:pl-4 [&_li]:mb-1"
            dangerouslySetInnerHTML={{
              __html: formatRecContent(rec.content),
            }}
          />

          <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/30">
            {rec.status === "implemented" && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Implemented
              </span>
            )}
            {rec.status === "dismissed" && (
              <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                <XCircle className="w-3.5 h-3.5" />
                Dismissed
              </span>
            )}
            {rec.status === "pending" && (
              <>
                {onCopyPrompt && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy Prompt
                      </>
                    )}
                  </button>
                )}
                {onDismiss && (
                  <button
                    onClick={onDismiss}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Dismiss
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd packages/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in RecommendationItem.tsx (other files may error until Task 2-3 are done)

**Step 3: Commit**

```bash
git add packages/frontend/app/admin/entitlements/analytics/components/RecommendationItem.tsx
git commit -m "feat: replace Implement button with Copy Prompt in RecommendationItem"
```

---

### Task 2: Update InsightCategoryCard — Pass onCopyPrompt Instead of onImplement

**Files:**

- Modify: `packages/frontend/app/admin/entitlements/analytics/components/InsightCategoryCard.tsx`

**Step 1: Update the interface and props**

Replace the interface (lines 8-21):

```tsx
interface InsightCategoryCardProps {
  icon: string;
  title: string;
  content: string;
  defaultOpen?: boolean;
  recommendations?: ParsedRecommendation[];
  /** Called when user clicks "Copy Prompt" on a recommendation. */
  onCopyPrompt?: (rec: ParsedRecommendation) => void;
  /** Called when user clicks "Dismiss" on a recommendation. */
  onDismiss?: (rec: ParsedRecommendation) => void;
}
```

**Step 2: Update the destructured props and RecommendationItem usage**

Replace lines 23-31 (destructuring):

```tsx
export function InsightCategoryCard({
  icon,
  title,
  content,
  defaultOpen = true,
  recommendations,
  onCopyPrompt,
  onDismiss,
}: InsightCategoryCardProps) {
```

Replace lines 65-72 (RecommendationItem render):

```tsx
{
  categoryRecs.map((rec) => (
    <RecommendationItem
      key={rec.id}
      recommendation={rec}
      onCopyPrompt={onCopyPrompt ? () => onCopyPrompt(rec) : undefined}
      onDismiss={onDismiss ? () => onDismiss(rec) : undefined}
    />
  ));
}
```

**Step 3: Commit**

```bash
git add packages/frontend/app/admin/entitlements/analytics/components/InsightCategoryCard.tsx
git commit -m "feat: pass onCopyPrompt through InsightCategoryCard to RecommendationItem"
```

---

### Task 3: Update AiInsightsPanel — Remove Executor, Add Copy Logic

**Files:**

- Modify: `packages/frontend/app/admin/entitlements/analytics/components/AiInsightsPanel.tsx`

**Step 1: Replace imports** (lines 1-15)

Remove:

- `import { useRecommendationExecutor } from "../hooks/useRecommendationExecutor";`
- `import { ImplementPreview } from "./ImplementPreview";`

Add:

- `import { buildImplementPrompt } from "../utils/buildImplementPrompt";`

**Step 2: Remove executor state and callbacks**

Remove these state declarations (lines 30-33):

```tsx
const [implementingRec, setImplementingRec] = useState<{
  rec: ParsedRecommendation;
  insightId: string;
} | null>(null);
```

Remove this line (line 46):

```tsx
const executor = useRecommendationExecutor();
```

Remove `canImplement` from derived state (line 66):

```tsx
const canImplement = !!currentInsightId;
```

**Step 3: Replace handleImplement with handleCopyPrompt**

Replace `handleImplement` (lines 135-142) with:

```tsx
const handleCopyPrompt = useCallback(
  async (rec: ParsedRecommendation) => {
    const prompt = buildImplementPrompt(rec, currentMarkdown);
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // Fallback: silent fail — button still shows "Copied!" via RecommendationItem state
    }
  },
  [currentMarkdown],
);
```

**Step 4: Remove handleExecutePlan callback** (lines 162-176) — delete entirely.

**Step 5: Update InsightCategoryCard usage** in JSX (around lines 281-292)

Replace:

```tsx
<InsightCategoryCard
  key={section.title}
  icon={section.icon}
  title={section.title}
  content={section.content}
  recommendations={currentRecs}
  onImplement={canImplement ? handleImplement : undefined}
  onDismiss={canImplement ? handleDismiss : undefined}
  implementingRecId={implementingRec?.rec.id ?? null}
/>
```

With:

```tsx
<InsightCategoryCard
  key={section.title}
  icon={section.icon}
  title={section.title}
  content={section.content}
  recommendations={currentRecs}
  onCopyPrompt={handleCopyPrompt}
  onDismiss={currentInsightId ? handleDismiss : undefined}
/>
```

**Step 6: Remove ImplementPreview from JSX** (lines 319-331) — delete the entire block:

```tsx
      {executor.currentPlan && implementingRec && (
        <ImplementPreview ... />
      )}
```

**Step 7: Verify TypeScript compiles**

Run: `cd packages/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean compile

**Step 8: Commit**

```bash
git add packages/frontend/app/admin/entitlements/analytics/components/AiInsightsPanel.tsx
git commit -m "feat: replace AI plan generation with clipboard copy in AiInsightsPanel"
```

---

### Task 4: Remove Dead Frontend Files

**Files:**

- Delete: `packages/frontend/app/admin/entitlements/analytics/hooks/useRecommendationExecutor.ts`
- Delete: `packages/frontend/app/admin/entitlements/analytics/components/ImplementPreview.tsx`

**Step 1: Verify no other imports reference these files**

Run: `grep -r "useRecommendationExecutor\|ImplementPreview" packages/frontend/app/admin/entitlements/analytics/ --include="*.ts" --include="*.tsx"`
Expected: Zero matches (after Task 3 removes the imports from AiInsightsPanel)

**Step 2: Delete the files**

```bash
rm packages/frontend/app/admin/entitlements/analytics/hooks/useRecommendationExecutor.ts
rm packages/frontend/app/admin/entitlements/analytics/components/ImplementPreview.tsx
```

**Step 3: Verify build**

Run: `cd packages/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean compile

**Step 4: Commit**

```bash
git add -u packages/frontend/app/admin/entitlements/analytics/
git commit -m "chore: remove dead useRecommendationExecutor hook and ImplementPreview component"
```

---

### Task 5: Clean Up Backend — Remove Plan/Execute Endpoints

**Files:**

- Modify: `packages/backend/src/admin/analytics/ai-insights-persistence.controller.ts` (remove lines 142-249)
- Modify: `packages/backend/src/admin/analytics/analytics.module.ts` (remove RecommendationExecutorService from providers, FeaturesModule from imports)
- Delete: `packages/backend/src/admin/analytics/recommendation-executor.service.ts`

**Step 1: Remove plan/execute endpoints from controller**

In `ai-insights-persistence.controller.ts`, delete the `generatePlan` method (lines 142-209) and the `executePlan` method (lines 211-249).

Also remove unused imports from the top:

- Remove `Res` from `@nestjs/common` imports (line 26)
- Remove `Response` from `express` imports (line 35) — keep `Request`
- Remove `RecommendationExecutorService` import (line 38)
- Remove `parseRecommendationsFromMarkdown` import (line 39) — only used in create, check if still needed
- Remove `ImplementationPlan` from types import (line 44)

Remove `executor` from the constructor (lines 59-62):

```typescript
  constructor(
    private readonly persistence: AiInsightsPersistenceService,
  ) {}
```

**Step 2: Update the module**

In `analytics.module.ts`, remove:

- Line 10: `import { RecommendationExecutorService } from './recommendation-executor.service';`
- Line 12: `import { FeaturesModule } from '../features/features.module';` (only needed by executor)
- Line 15: `FeaturesModule` from imports array
- Line 26: `RecommendationExecutorService` from providers array

**Step 3: Delete the service file**

```bash
rm packages/backend/src/admin/analytics/recommendation-executor.service.ts
```

**Step 4: Verify backend compiles**

Run: `cd packages/backend && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean compile

**Step 5: Commit**

```bash
git add -u packages/backend/src/admin/analytics/
git commit -m "chore: remove AI plan generation and execution backend code"
```

---

### Task 6: Verify End-to-End

**Step 1: Start dev servers**

Run frontend and backend dev servers.

**Step 2: Test the copy flow**

1. Navigate to `/admin/entitlements/analytics`
2. Generate insights or load a saved report
3. Expand a recommendation
4. Click "Copy Prompt"
5. Verify button shows "Copied!" for 2 seconds
6. Paste into a text editor — verify the prompt contains recommendation details + full insight markdown

**Step 3: Test dismiss still works**

1. On a saved report, expand a recommendation
2. Click "Dismiss"
3. Verify status changes to "Dismissed"

**Step 4: Final commit if any fixes needed**
