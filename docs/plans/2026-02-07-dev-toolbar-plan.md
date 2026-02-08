# Dev Toolbar Implementation Plan

Reference design: `docs/plans/2026-02-07-dev-toolbar-design.md`

## Phase 1: Context Extensions

### Task 1.1: Add simulatedAuth to EntitlementsContext
**File**: `packages/frontend/lib/entitlements/EntitlementsContext.tsx`

Steps:
1. Add `simulatedAuth` state: `const [simulatedAuth, setSimulatedAuth] = useState<boolean | null>(null)` (null = no override)
2. Add both to the context value object (alongside existing `simulatedTier`/`setSimulatedTier`)
3. Add `simulatedAuth` and `setSimulatedAuth` to `EntitlementsContextValue` interface
4. Add a `resetSimulation()` function that sets both `simulatedTier` and `simulatedAuth` to null, and calls `refresh()`
5. Add `resetSimulation` to the context value and interface

**Verify**: TypeScript compiles, existing tests still pass

### Task 1.2: Export simulatedAuth from entitlements index
**File**: `packages/frontend/lib/entitlements/types.ts`

Steps:
1. If needed, add `simulatedAuth` and `setSimulatedAuth` to exported types
2. Verify re-export from `index.ts` covers it (already exports `*` from types)

**Verify**: TypeScript compiles

### Task 1.3: Wire simulatedAuth into paywall components
**Files**: `PaywallOverlay.tsx`, `ScorePaywall.tsx`, `InsightsPaywall.tsx`

Steps:
1. In each file, import `useEntitlements` and read `simulatedAuth`
2. Modify the auth check: if `simulatedAuth !== null`, use `simulatedAuth` instead of Supabase session
3. Pattern:
   ```typescript
   const { simulatedAuth } = useEntitlements();
   useEffect(() => {
     if (simulatedAuth !== null) {
       setIsAuthenticated(simulatedAuth);
       return;
     }
     // existing Supabase check
   }, [simulatedAuth]);
   ```

**Verify**: TypeScript compiles, existing EntitlementGate tests pass

## Phase 2: DevToolbar Component

### Task 2.1: Create DevToolbar shell with activation logic
**File**: `packages/frontend/components/dev/DevToolbar.tsx` (new)

Steps:
1. Create the component with activation check:
   - Check `process.env.NODE_ENV === 'development'`
   - Check `sessionStorage.getItem('devtools-active') === 'true'`
   - On mount, check URL for `?devtools=<key>` param and set sessionStorage if matched
   - Key comes from `process.env.NEXT_PUBLIC_DEVTOOLS_KEY` or defaults to `'dev'`
2. If not activated, render `null`
3. Render a fixed-position bottom bar as placeholder
4. Add `expanded` state toggle

**Verify**: Component renders in dev mode, doesn't render when conditions aren't met

### Task 2.2: Build the collapsed bottom bar
**File**: `packages/frontend/components/dev/DevToolbar.tsx`

Steps:
1. Import `useEntitlements` to read current state
2. Render fixed bottom bar with:
   - **Tier badge**: Colored chip showing `simulatedTier || tier`. Click cycles through `free → pro → enterprise → admin → free`
   - **Auth indicator**: "Anon" or "Authed" based on `simulatedAuth` state
   - **Resource summary**: Map over `access` object entries for current page resources, show `key → level` in compact form
   - **Admin gear icon**: `<Link href="/dev/admin/entitlements">`
   - **Expand chevron**: Toggles `expanded` state
3. Style with M3 tokens: `bg-surface-container-highest/95 border-t border-outline-variant`
4. Use `z-50` for stacking

**Verify**: Bar renders at bottom, tier badge shows correct tier, click cycles tiers

### Task 2.3: Build the expanded panel — Left column (Simulation Controls)
**File**: `packages/frontend/components/dev/DevToolbar.tsx`

Steps:
1. When `expanded`, render a panel above the bar (~300px)
2. Left column:
   - Tier segmented control: four buttons (Free/Pro/Enterprise/Admin), active state highlighted
   - Each calls `setSimulatedTier(tier)`
   - Auth toggle: two buttons (Anonymous/Authenticated), calls `setSimulatedAuth(true/false)`
   - Reset button: calls `resetSimulation()`, clears sessionStorage overrides

**Verify**: Clicking tiers changes the tier badge, page content updates to reflect new access levels

### Task 2.4: Build the expanded panel — Center column (Live State)
**File**: `packages/frontend/components/dev/DevToolbar.tsx`

Steps:
1. Center column shows:
   - Current tier text
   - Trial status: active/inactive, days remaining (from `trial` in context)
   - Resource access table: scrollable div, iterate over `access` entries
   - Each row: resource key, colored dot (green/yellow/red for full/preview/none), access level, preview limit, tier required
2. Use `max-h-[240px] overflow-y-auto` for scrollable table

**Verify**: Resource table populates correctly, colors match access levels

### Task 2.5: Build the expanded panel — Right column (Admin Nav + Resource Checker)
**File**: `packages/frontend/components/dev/DevToolbar.tsx`

Steps:
1. Right column:
   - List of links to admin pages with labels
   - Text input for resource checker
   - On input change, call `getAccess(type, id)` by splitting on `:` — display result below input
   - Show access level + tier required for typed resource
2. Admin links: array of `{ label, href }` mapped to `<Link>` elements

**Verify**: Links navigate correctly, resource checker returns correct access info

## Phase 3: Integration

### Task 3.1: Mount DevToolbar in layout
**File**: `packages/frontend/app/layout.tsx`

Steps:
1. Add dynamic import: `const DevToolbar = dynamic(() => import('@/components/dev/DevToolbar').then(m => ({ default: m.DevToolbar })), { ssr: false })`
2. Render `<DevToolbar />` inside `<Providers>`, after the footer
3. Import `dynamic` from `next/dynamic`

**Verify**: Toolbar appears in dev mode at bottom of page. Does not appear in production build.

### Task 3.2: Add bottom padding to prevent content overlap
**File**: `packages/frontend/app/layout.tsx` or `globals.css`

Steps:
1. Add `pb-10` (or similar) to the body/main when toolbar is active, to prevent the bar from covering the footer
2. Alternative: add margin-bottom to the footer element
3. Keep it simple — a CSS class or inline style conditional on dev mode

**Verify**: Footer text is not hidden behind the toolbar

## Phase 4: Tests

### Task 4.1: Write DevToolbar unit tests
**File**: `packages/frontend/components/dev/__tests__/DevToolbar.test.tsx` (new)

Steps:
1. Test activation logic:
   - Renders in development mode
   - Doesn't render when env conditions aren't met
   - Activates via URL param + sessionStorage
2. Test tier cycling: clicking badge cycles free → pro → enterprise → admin → free
3. Test expand/collapse toggle
4. Test tier switcher calls setSimulatedTier
5. Test auth toggle calls setSimulatedAuth
6. Test reset clears all simulation state
7. Test admin links render correctly
8. Test resource checker input + display

**Verify**: All tests pass with `npx vitest run components/dev`

### Task 4.2: Verify all existing tests still pass
Steps:
1. Run full test suite: `npx vitest run`
2. Fix any regressions from context changes

**Verify**: All tests pass (33 entitlements + any new toolbar tests)
