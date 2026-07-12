# Analyzer: User-Editable Auto-Kill Criteria — Design

**Date:** 2026-07-12
**Status:** Approved for planning
**Owner:** Analyzer (frontend + analyzer-core + backend)

## Problem

Auto-kill rules (the checks that force a deal grade to F, e.g. "DSCR below 1.0")
are hardcoded literals inside `@propertyiq/analyzer-core`'s per-strategy
`collect*AutoKills()` functions. Users cannot see, tune, or disable them. The
Auto-Kill banner tells the user a rule fired but offers no path to adjust it,
and the Customize drawer (thresholds / weights / assumptions) does not cover
auto-kills at all.

## Goals

1. A button in the **top-right of the Auto-Kill Triggered banner** that opens
   auto-kill editing.
2. An entry point in the **Advanced Assumptions** section of the input panel
   for auto-kill + grading criteria.
3. Auto-kill rules are **fully editable**: per-rule enable/disable toggle plus
   an editable numeric limit where the rule has one.
4. Settings are **persisted per user** (account-level), not per deal. Editing
   them once affects every subsequent analysis by that user. Deal-level
   acknowledgment flags (e.g. `appreciationPlayAccepted`) remain per-deal and
   are out of scope.

## Non-Goals

- No new settings surface outside the existing Customize drawer.
- No changes to preset definitions (Conservative / Balanced / Aggressive
  continue to define thresholds + weights only).
- No admin/global override of auto-kill rules.
- No changes to MCP tools (they inherit the user's saved rules automatically
  via the backend resolution path).

## Architecture: config rides the existing thresholds pipeline

Auto-kill config becomes an optional `autoKills` block on the per-strategy
`UserThresholds` object. This reuses, unchanged:

- Persistence: `user_thresholds(user_id, strategy, thresholds JSONB)` upsert —
  **no migration** (JSONB widens transparently).
- API: `PUT /api/analyzer/thresholds/:strategy` + GET counterpart.
- Resolution order in `GradingService.resolveThresholds()`:
  request `overrideThresholds` → user's saved row → strategy default.
- Delivery to the engine: `UserThresholds` is already passed into grading.

### Rule inventory (defaults = today's hardcoded literals)

| Strategy | Rule key                   | Kill code                         | Toggle | Limit (default)             |
| -------- | -------------------------- | --------------------------------- | ------ | --------------------------- |
| B&H      | `dscrFloor`                | `DSCR_BELOW_1`                    | yes    | DSCR floor (1.0)            |
| B&H      | `taxInsShareOfRent`        | `TAX_INS_OVER_40`                 | yes    | share of annual rent (0.40) |
| B&H      | `floodNoInsurance`         | `FLOOD_NO_INSURANCE`              | yes    | —                           |
| B&H      | `negativeCashflowNoAck`    | `NEG_CF_NO_APPRECIATION_ACK`      | yes    | —                           |
| F&F      | `projectLoss`              | `PROJECT_LOSS`                    | yes    | —                           |
| F&F      | `minNetProfit`             | `PROFIT_BELOW_FLOOR`              | yes    | dollars (10 000)            |
| F&F      | `rehabContingency`         | `REHAB_UNVERIFIED_NO_CONTINGENCY` | yes    | contingency share (0.10)    |
| F&F      | `extremeHold`              | `EXTREME_HOLD`                    | yes    | × market DOM (2)            |
| BRRRR    | `refiDscrFloor`            | `REFI_NOT_FINANCEABLE`            | yes    | DSCR floor (1.0)            |
| BRRRR    | `negativePostRefiCashflow` | `NEGATIVE_POST_REFI_CASHFLOW`     | yes    | —                           |
| BRRRR    | `rehabContingency`         | `REHAB_UNVERIFIED_NO_CONTINGENCY` | yes    | contingency share (0.10)    |
| BRRRR    | `maxCashLeft`              | `CASH_LEFT_EXCEEDS_MAXIMUM`       | yes    | dollars (10 000)            |

### Config shape (per strategy, all fields optional)

```ts
// analyzer-core, per strategy — example: BuyAndHoldAutoKillConfig
interface AutoKillRuleConfig {
  enabled?: boolean; // default true
  value?: number; // only for rules with a limit; default = literal above
}
interface BuyAndHoldAutoKillConfig {
  dscrFloor?: AutoKillRuleConfig;
  taxInsShareOfRent?: AutoKillRuleConfig;
  floodNoInsurance?: AutoKillRuleConfig; // toggle-only (value ignored)
  negativeCashflowNoAck?: AutoKillRuleConfig;
}
```

`collect*AutoKills(ctx, config?)` resolves each rule as
`config?.rule?.enabled ?? true` and `config?.rule?.value ?? DEFAULT`. Exported
`DEFAULT_*_AUTOKILLS` constants let the drawer render defaults and power
"Reset". **Back-compat invariant:** absent/partial config must produce
byte-identical behavior to today (verified by tests).

Semantics: a **disabled rule never fires**. An enabled rule can still be
suppressed by its existing deal-level acknowledgment flag (unchanged).

## Backend

- `user-thresholds.dto.ts`: optional nested `autoKills` DTO per strategy;
  per-rule `enabled?: boolean` + bounded `value?: number`
  (DSCR floor 0.3–2.0; shares 0.05–1.0; dollars 0–500 000; DOM multiple 1–10).
  `forbidNonWhitelisted` stays on.
- `thresholds.service.ts`, `grading.service.ts`: no logic changes; the block
  flows through JSONB and `resolveThresholds()` as part of `UserThresholds`.
- Engine call sites pass `thresholds.autoKills` into `collect*AutoKills()`.

## Frontend

### Customize drawer

- New 4th tab **"Auto-Kill"** (`AutoKillTab.tsx`, own file): one row per rule
  for the **active strategy** (same scoping as the Thresholds tab) — M3 switch
  - numeric field (hidden for toggle-only rules) + one-line helper text.
- `useDrawerState`: draft `autoKills` state, dirty tracking, validation
  (mirrors DTO bounds), included in the existing save PUT and in Reset All.
  If the file exceeds the 300-line hard limit, split the auto-kill slice into
  `useAutoKillDraft.ts`.
- Preset switching does **not** modify the auto-kills block.
- Drawer gains `initialTab?: ThresholdsTabId` so callers can deep-link a tab.

### Entry points

- **AutoKillBanner**: new optional `onEditCriteria?: () => void`. Header row
  becomes flex; top-right renders an error-tinted text button "Edit criteria"
  (M3 text button, `rounded-full`). Rendered only when the callback is passed.
  Opens the drawer on the Auto-Kill tab.
- **AdvancedAssumptions**: new optional `onCustomizeClick?: () => void`.
  Bottom of the section gets a bordered link row:
  "⚙ Auto-kill & grading criteria — Edit thresholds, weights, and auto-kill
  rules → Customize". Opens the same drawer on the Auto-Kill tab.
- **Threading**: `InputPanel` gains `onCustomizeClick?` and forwards it to
  `AdvancedAssumptions`. `AnalyzerClient` sets it in the shared `inputPanel`
  element (works in desktop sidebar and mobile sheet without touching
  `MobileInputSheet`). Drawer open state becomes `{open, initialTab}` (or an
  additional `drawerTab` state) in `AnalyzerClient`;
  `GradingResultPanel` forwards `onEditCriteria` to `AutoKillBanner`.

## Error handling

- Drawer validation blocks save on out-of-bounds values (inline field errors,
  same pattern as threshold errors).
- Backend DTO rejects out-of-bounds/unknown fields with 400; drawer surfaces
  the existing failure banner.
- Grading remains resilient: malformed/absent config → defaults (engine-side
  `??` fallbacks), never a thrown error.

## Testing

1. **analyzer-core unit tests** (per strategy): custom limit honored (DSCR
   floor 0.8 → deal at 0.9 passes), disabled rule never fires, default config
   ≡ no config (regression suite runs both and diffs results).
2. **Backend DTO tests**: valid block accepted; out-of-bounds value and
   unknown rule key rejected.
3. **Component tests**: AutoKillTab renders active-strategy rules + validates;
   banner renders "Edit criteria" only with callback and fires it;
   AdvancedAssumptions link row fires callback; drawer opens on `initialTab`.
4. **E2E against real backend + DB** (no mocks): analyze the Frederick MD
   deal (DSCR 0.35) → banner shows DSCR kill → open drawer from banner button
   → disable DSCR rule → save → regrade → DSCR line gone from banner; re-open
   drawer → setting persisted (round-trips the DB). Restore defaults after.
5. **analyzer-core rebuild**: `npm run build` in analyzer-core before frontend
   verification (frontend consumes `dist/`).

## Rollout / compat

- Existing `user_thresholds` rows lack `autoKills` → defaults apply; no
  backfill needed.
- Old clients sending threshold payloads without `autoKills` keep working
  (field optional).
- No entitlement change: drawer is already available wherever grading is.
