# Graphs Page Favorites Selector

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Add database-backed favorites as selectable options in the graphs page search dropdown

## Problem

Users save favorite markets (via the map page watchlist), but cannot use those favorites on the graphs page. To chart a favorited market, they must re-search for it every time.

## Solution

Surface the user's database watchlist inside the existing `MarketSearchBar` search dropdown on the graphs page. Each favorite shows inline "Main" and "Compare" buttons so users can assign markets to chart slots without friction.

## Design Decisions

| Decision                | Choice                                          | Rationale                                                                        |
| ----------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| Placement               | Inside search dropdown                          | Least obtrusive — no new permanent UI, lives in existing flow                    |
| Data source             | Database watchlist (`/api/analytics/watchlist`) | Persists across devices, already built on backend                                |
| Search interaction      | Filter favorites + results together             | Typing "Aus" shows favorited "Austin" at top, plus matching search results below |
| Unauthenticated state   | "Save your favorite markets" + sign-in CTA      | Subtle conversion nudge, single row                                              |
| Empty state (logged in) | "No favorites yet" + link to map                | One line, not obtrusive                                                          |

## Architecture

### 1. Data Layer

**Existing hook:** `components/analytics-assistant/persistence/useWatchlist.ts` already provides full CRUD via Next.js API routes that proxy to the backend. However, it uses `useState`/`useEffect` instead of React Query and requires an explicit `userId` parameter.

**Migration approach:** Create a new `lib/data` wrapper that uses React Query for caching and deduplication. This becomes the canonical data layer entry point per CLAUDE.md rules. The existing hook can be migrated later.

**`packages/frontend/lib/data/fetchers/watchlist.ts`**

```typescript
fetchWatchlist(): Promise<WatchlistItem[]>
// GET /api/analytics/watchlist — requires auth headers
// Backend returns { success, data, count, limit, remaining }
// Fetcher unwraps .data from response

addToWatchlist(dto: AddToWatchlistDto): Promise<WatchlistItem>
// POST /api/analytics/watchlist

removeFromWatchlist(geographyType: string, geographyId: string): Promise<void>
// DELETE /api/analytics/watchlist/geography/:type/:geoId
```

**`packages/frontend/lib/data/hooks/useWatchlist.ts`**

```typescript
useWatchlist(): {
  favorites: WatchlistItem[];
  isLoading: boolean;
  error: Error | null;
}
// React Query wrapper with 5-minute stale time
// Uses useAuth() from @/lib/auth to detect auth state
// Returns empty array when unauthenticated (skips query, no error)
```

**Types** (co-located in fetcher file):

```typescript
interface WatchlistItem {
  id: string;
  geography_type: string; // 'metro' | 'county' | 'zip' | 'state'
  geography_id: string; // CBSA code, FIPS, ZIP
  geography_name: string; // Always present — backend requires on add
  tags?: string[];
  folder?: string;
  added_at: string;
  score_at_add?: number;
}
```

All exports added to `lib/data/index.ts`.

### 2. MarketSearchBar Changes

**File:** `packages/frontend/app/graphs/components/MarketSearchBar.tsx`

**New props:**

```typescript
// Existing
onSelectMarket: (market: MyMarket) => void;
// New
onSelectAsPrimary?: (market: MyMarket) => void;
onSelectAsComparison?: (market: MyMarket) => void;
```

The parent (`GraphsPageV2`) passes these, wired to `setPrimaryMarket` and `setComparisonMarket` from `useGraphsState`. Auth state detected via `useAuth()` from `@/lib/auth`.

**Dropdown states by query length:**

| State                      | Favorites Section                                 | Search Results Section                           |
| -------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| Open, empty query          | All favorites (filtered to metro/county/zip only) | Hidden — show hint: "Type to search all markets" |
| Open, 1 character          | Favorites matching query                          | Hidden — "Type 2+ characters to search"          |
| Open, 2+ chars, matches    | Favorites matching query (if any)                 | Search results under "Search Results" divider    |
| Open, 2+ chars, no matches | "No matching favorites" (or hidden if 0)          | Search results under "Search Results" divider    |
| Loading favorites          | Skeleton row (single animated placeholder)        | Normal search behavior                           |

**Favorites filtering:** Case-insensitive substring match on `geography_name`. Non-supported geography types (`state`, `national`) are filtered out before display since the graphs page only supports metro/county/zip.

**Click actions:**

- **Click "Main" button:** Call `onSelectAsPrimary(watchlistItemToMarket(item))` → close dropdown
- **Click "Compare" button:** Call `onSelectAsComparison(watchlistItemToMarket(item))` → close dropdown
- **Click row (not a button):** Call `onSelectMarket(watchlistItemToMarket(item))` → existing behavior (sets primary if empty, else comparison)

**Auth/empty states (rendered at top of dropdown):**

| State                        | Display                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| Not authenticated            | Single row: "⭐ Save your favorite markets · [Sign in](/auth/login)" |
| Authenticated, loading       | Single skeleton row (shimmer animation)                              |
| Authenticated, no favorites  | Single row: "⭐ No favorites yet — [add markets from the map](/map)" |
| Authenticated with favorites | Full favorites list with Main/Compare buttons                        |

### 3. Data Conversion

Watchlist items need to be converted to the `MyMarket` format that `useGraphsState` expects:

```typescript
function watchlistItemToMarket(item: WatchlistItem): MyMarket {
  return {
    id: item.geography_id,
    name: item.geography_name, // Always present per backend contract
    type: item.geography_type,
    score: item.score_at_add ?? null,
    isPinned: true,
  };
}
```

### 4. MarketSlots Integration

The sidebar `MarketSlots` component has a different architecture (portal-based dropdown, slot-based `onAdd` callback). Show favorites as quick-select items in its dropdown — no Main/Compare buttons. Clicking a favorite calls the existing `onAdd(market)` which adds to the next available slot. Same filtering and auth/empty state logic as MarketSearchBar.

## Out of Scope

- Folders/tags UI (backend supports it, not surfaced here)
- Adding/removing favorites from the graphs page (managed on map page)
- Scores display in favorites list (visible after selection)
- Mobile-specific favorites UI beyond the search dropdown
- Migrating the existing `useWatchlist` hook (separate task)

## Files Changed

| File                                        | Change                                         |
| ------------------------------------------- | ---------------------------------------------- |
| `lib/data/fetchers/watchlist.ts`            | **New** — watchlist API fetchers               |
| `lib/data/hooks/useWatchlist.ts`            | **New** — React Query hook                     |
| `lib/data/index.ts`                         | Export new fetchers + hook + types             |
| `app/graphs/components/MarketSearchBar.tsx` | Add favorites section to dropdown + new props  |
| `app/graphs/components/MarketSlots.tsx`     | Add favorites as quick-select in slot dropdown |

## Testing

- Verify favorites appear when dropdown opens (authenticated user with favorites)
- Verify skeleton loading state while fetching
- Verify empty state when no favorites
- Verify sign-in CTA when unauthenticated
- Verify filtering works: type partial name → matching favorites appear above search results
- Verify "Main" button calls `onSelectAsPrimary` and sets primary market
- Verify "Compare" button calls `onSelectAsComparison` and sets comparison market
- Verify row click defaults to primary (if empty) or comparison
- Verify dropdown closes after selection
- Verify state/national geography types in watchlist are filtered out
- Verify MarketSlots shows favorites and adds to next available slot on click
