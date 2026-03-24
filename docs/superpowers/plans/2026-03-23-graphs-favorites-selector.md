# Graphs Page Favorites Selector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Surface database-backed favorites in the graphs page search dropdowns so users can quickly set a favorite as the main or comparison chart market.

**Architecture:** New `lib/data` fetcher + React Query hook for the watchlist API. MarketSearchBar gets a favorites section in its dropdown with Main/Compare buttons. MarketSlots gets favorites as quick-select items.

**Tech Stack:** React Query (TanStack), Next.js App Router, existing NestJS watchlist API

**Spec:** `docs/superpowers/specs/2026-03-23-graphs-favorites-selector-design.md`

---

## Task 1: Watchlist Data Layer (fetcher + hook + exports)

**Files:**

- Create: `packages/frontend/lib/data/fetchers/watchlist.ts`
- Create: `packages/frontend/lib/data/hooks/useWatchlist.ts`
- Modify: `packages/frontend/lib/data/index.ts`

### Fetcher (`watchlist.ts`)

- [ ] Create `packages/frontend/lib/data/fetchers/watchlist.ts`
- [ ] Export `WatchlistItem` interface: `{ id, geography_type, geography_id, geography_name, tags?, folder?, added_at, score_at_add? }`
- [ ] Export `fetchWatchlist()` — `GET ${API_URL}/api/analytics/watchlist` with `getAuthHeaders()`. Backend returns `{ success, data, count, limit, remaining }` — unwrap `.data` and return `WatchlistItem[]`.
- [ ] Export `addToWatchlist(dto)` — `POST ${API_URL}/api/analytics/watchlist` with auth headers + JSON body
- [ ] Export `removeFromWatchlist(geographyType, geographyId)` — `DELETE ${API_URL}/api/analytics/watchlist/geography/${type}/${geoId}` with auth headers

Follow the pattern in existing fetchers like `packages/frontend/lib/data/fetchers/reports.ts` — use `API_URL` from `./base` and `getAuthHeaders` from `./auth-headers`.

### Hook (`useWatchlist.ts`)

- [ ] Create `packages/frontend/lib/data/hooks/useWatchlist.ts`
- [ ] Use `useQuery` from `@tanstack/react-query` with key `['watchlist']`
- [ ] Use `useAuth()` from `@/lib/auth` — if `!user`, return `{ favorites: [], isLoading: false, error: null }` without making the query (set `enabled: !!user`)
- [ ] Set `staleTime: 5 * 60 * 1000` (5 minutes)
- [ ] Return `{ favorites: WatchlistItem[], isLoading: boolean, error: Error | null }`

### Exports

- [ ] Add to `packages/frontend/lib/data/index.ts`: export `fetchWatchlist`, `addToWatchlist`, `removeFromWatchlist`, `WatchlistItem` from fetchers, and `useWatchlist` from hooks

### Commit

- [ ] `git add` the 3 files and commit: `feat(data): add watchlist fetcher and useWatchlist hook`

---

## Task 2: MarketSearchBar — Favorites in Dropdown

**Files:**

- Modify: `packages/frontend/app/graphs/components/MarketSearchBar.tsx`
- Modify: `packages/frontend/app/graphs/components/GraphsPageV2/GraphsPageV2.tsx`

### New props

- [ ] Add optional props `onSelectAsPrimary?: (market: MyMarket) => void` and `onSelectAsComparison?: (market: MyMarket) => void` to MarketSearchBar's props interface

### Watchlist integration

- [ ] Import `useWatchlist` from `@/lib/data` and `useAuth` from `@/lib/auth`
- [ ] Call `useWatchlist()` inside the component. Call `useAuth()` for auth state.
- [ ] Create a `watchlistItemToMarket` helper function (spec section 3)
- [ ] Filter favorites: exclude `geography_type` not in `['metro', 'county', 'zip']`
- [ ] When `searchQuery` is non-empty, filter favorites by case-insensitive substring match on `geography_name`

### Favorites section in dropdown

- [ ] Above the existing search results, render a favorites section:
  - **Not authenticated:** Single muted row — "⭐ Save your favorite markets · Sign in" (Link to `/auth/login`)
  - **Loading:** Single skeleton row with shimmer animation
  - **No favorites:** Single muted row — "⭐ No favorites yet — add markets from the map" (Link to `/map`)
  - **Has favorites:** "⭐ Your Favorites" header, then list of items. Each row shows market name + geo type badge + `Main` (filled pill) + `Compare` (outlined pill) buttons.
- [ ] When `searchQuery` is non-empty and search results exist, add a "Search Results" divider label above the regular results

### Click handlers

- [ ] "Main" button: call `onSelectAsPrimary?.(watchlistItemToMarket(item))`, close dropdown
- [ ] "Compare" button: call `onSelectAsComparison?.(watchlistItemToMarket(item))`, close dropdown
- [ ] Row click (not on a button): call existing `onSelectMarket(watchlistItemToMarket(item))`

### Wire up in GraphsPageV2

- [ ] In `GraphsPageV2.tsx`, where `<MarketSearchBar>` is rendered (~line 501), add `onSelectAsPrimary={setPrimaryMarket}` and `onSelectAsComparison={setComparisonMarket}` props

### Commit

- [ ] `git add` changed files and commit: `feat(graphs): add favorites section to MarketSearchBar dropdown`

---

## Task 3: MarketSlots — Favorites as Quick-Select

**Files:**

- Modify: `packages/frontend/app/graphs/components/MarketSlots.tsx`

### Watchlist integration

- [ ] Import `useWatchlist` from `@/lib/data` and `useAuth` from `@/lib/auth`
- [ ] Same `watchlistItemToMarket` conversion (can import from a shared location or inline)
- [ ] Same geo type filtering (metro/county/zip only)
- [ ] Same query filtering as MarketSearchBar

### Favorites in AddSlot dropdown

- [ ] In the `AddSlot` dropdown (the portal-based search), add a favorites section above search results
- [ ] Same auth/empty/loading states as MarketSearchBar
- [ ] No Main/Compare buttons — clicking a favorite calls the existing `onAdd(watchlistItemToMarket(item))` which adds to next available slot
- [ ] When search query exists, filter favorites the same way and show "Search Results" divider

### Commit

- [ ] `git add` changed file and commit: `feat(graphs): add favorites quick-select to MarketSlots`
