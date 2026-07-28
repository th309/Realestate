# Blog Archive & State Browse — Design Spec

**Date:** 2026-07-26
**Status:** Approved (brainstorming session with Troy)
**Scope:** `packages/frontend` blog subtree only. No backend changes.

## Problem

The blog index (`app/(app)/blog/page.tsx`) has 77 posts and growing, with only heuristic
grouping (city/roundup/comparison/strategy) and client-side text/market filters. Readers
have no way to browse posts by publication date or by U.S. state, and there are no
indexable facet URLs for either axis.

## Decisions (locked)

1. **Dedicated static archive pages** (not in-page-only widgets) — indexable, shareable,
   sitemap-registered. The blog index gets a compact "Browse the archive" panel linking
   to them.
2. **Explicit `states` frontmatter field is the source of truth** for state assignment,
   backfilled across all 77 posts via a reviewed one-time script. No runtime tag guessing.

## Routes

All statically generated (`generateStaticParams`), only emitted where ≥1 post exists.
`/blog/archive/...` (not `/blog/<year>/...`) avoids ambiguity with the existing
`/blog/[slug]` post route.

| Route                          | Content                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/blog/archive`                | Year → month tree with post counts                                                                                                               |
| `/blog/archive/[year]`         | Year's posts grouped by month                                                                                                                    |
| `/blog/archive/[year]/[month]` | Flat list of that month's posts (month = `01`–`12`, zero-padded)                                                                                 |
| `/blog/states`                 | A–Z list of states with counts, plus a "National" entry                                                                                          |
| `/blog/states/[state]`         | Posts for that state (slug = hyphenated lowercase full name, e.g. `north-carolina`); `national` is a reserved pseudo-slug for `states: []` posts |

## Data model

- `BlogFrontmatter` (`lib/blog/types.ts`) gains `states: string[]` — USPS two-letter
  codes (e.g. `["OH"]`). Empty array = national post. Multi-state posts list every state.
- State `code ↔ slug ↔ display name` lookups reuse the existing canonical table
  `lib/data/state-slug-data.ts` (already powers `/markets/state/[state]` and the
  sitemap — same slug convention site-wide). `lib/blog/extract-market.ts` is left
  completely untouched.
- New `lib/blog/archive.ts` helpers, all built on `getAllPosts()` (so the future-date
  filter and prod memoization carry over):
  - `getArchiveTree()` → `[{ year, months: [{ month, count }] }]`, newest first
  - `getPostsByMonth(year, month)`
  - `getStateIndex()` → `[{ code, slug, name, count }]` A–Z, plus national count
  - `getPostsByState(slugOrCode)` (national pseudo-slug supported)

## Backfill

- One-time script `scripts/blog/backfill-post-states.ts`:
  - Parses each post's tags/title/slug, normalizes casing + hyphen/space variants,
    matches against the state table plus a small city→state lookup for known city tags.
  - Emits a 77-row review table (file → suggested states → evidence). Claude reviews and
    presents the summary before any file is written.
  - Writes `states: [...]` into frontmatter, preserving all other keys and body byte-for-byte.
- Validation (corpus test, runs with the frontend test suite): every `.mdx` post must
  have a `states` key; every entry must be a valid USPS code. Missing key or bad code
  fails the test (not the production build — the blog loader stays lenient).
- `content/blog/Blog_rules.md.txt` updated so the content pipeline emits `states` on all
  future posts.

## Blog index panel

Compact "Browse the archive" section on `/blog` (below the Latest strip): two columns —
**By date** (year with month links + counts) and **By state** (A–Z chips with counts,
plus National). Pure links to the new routes; the existing grouping, market-chip filter,
text filter, and Latest strip are untouched. M3 styling per CLAUDE.md §8 (chips
`rounded-lg`/`rounded-full`, semantic color vars, no hardcoded hex).

## SEO plumbing

- Each new page exports proper `generateMetadata` (title/description; e.g. "Real Estate
  Market Analysis — April 2026 Archive", "Ohio Real Estate Blog Posts").
- New routes registered in `lib/seo/sitemap-builder.ts` next to the existing blogRoutes.
- RSS route and `/api/blog/metadata` JSON API are untouched.

## Error handling

- Unknown year/month/state params → `notFound()` (static params constrain the happy
  path; direct hits on non-generated params 404).
- Months/states with zero posts simply don't get pages or panel links.

## Testing

- Unit tests for `archive.ts` helpers (tree shape, month filtering, state grouping,
  national bucket, slug/code resolution).
- State slug/code resolution (including two-word slugs like `north-carolina`) is
  covered by the `archive.ts` tests via `lib/data/state-slug-data.ts`.
- Corpus validation test described under Backfill.
- Manual: build passes; spot-check `/blog/archive/2026/04`, `/blog/states/ohio`,
  `/blog/states/national` in the running app.

## Out of scope

- No changes to `getAllSlugs()` future-date behavior (pre-existing inconsistency, noted).
- No category facet pages, no pagination, no per-metro pages, no RSS changes.
- No `updated`/`image` frontmatter cleanup.
