# Blog Archive & State Browse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Statically generated blog facet pages — by date (`/blog/archive/[year]/[month]`) and by state (`/blog/states/[state]`) — backed by a new `states` frontmatter field, plus a "Browse the archive" panel on the blog index.

**Architecture:** Pure helper functions in `lib/blog/archive.ts` operate on injected `BlogPost[]` (unit-testable without the corpus); thin wrappers call `getAllPosts()` so future-date filtering and prod memoization carry over. State identity reuses the existing canonical `lib/data/state-slug-data.ts`. All new routes SSG via `generateStaticParams`.

**Tech Stack:** Next.js 16 App Router (params are Promises), gray-matter, vitest, Tailwind 4 with M3 semantic tokens.

**Spec:** `docs/superpowers/specs/2026-07-26-blog-archive-state-browse-design.md`

## Global Constraints

- Branch: `develop`. Commit with explicit pathspecs (`git commit -m "..." -- <paths>`). Never push unless asked.
- `states` frontmatter = USPS two-letter codes, e.g. `states: ["OH", "PA"]`. `states: []` = national. Slug for URLs = hyphenated lowercase full name from `STATE_SLUG_DATA` (`north-carolina`); `national` is a reserved pseudo-slug.
- Months in URLs are zero-padded `01`–`12`. Year/month extracted by string slicing ISO dates (`date.slice(0, 4)` / `date.slice(5, 7)`) — never `new Date()` (timezone shifts).
- No `revalidate`/`dynamic` exports anywhere under `app/(app)/blog/` — subtree stays fully static.
- UI: M3 semantic Tailwind tokens only (`bg-surface-container-low`, `text-on-surface-variant`, `bg-primary-container`, …). No hardcoded hex. Chips `rounded-full`, cards `rounded-xl`.
- File size: components <300 target / 400 hard; logic <200 target / 300 hard.
- Frontend tests: run from `packages/frontend` with `npx vitest run <path>` (suite is local-only, not in CI).
- All commands below run from `packages/frontend` unless a path says otherwise.

---

### Task 1: Extract shared PostCard components out of BlogIndexContent

Pure refactor, no behavior change. Archive/state pages (server components) need `PostCard`, but it currently lives inside the `"use client"` file `BlogIndexContent.tsx` (392 lines — near the 400 hard limit; this extraction also buys headroom for Task 6).

**Files:**

- Create: `packages/frontend/app/(app)/blog/components/PostCard.tsx`
- Modify: `packages/frontend/app/(app)/blog/BlogIndexContent.tsx`

**Interfaces:**

- Consumes: nothing new.
- Produces: `PostCard({ post, featured? })`, `CategoryChip({ category })`, `formatDate(dateString)`, `interface BlogPostSummary` — all exported from `app/(app)/blog/components/PostCard.tsx`. No `"use client"` directive (no hooks — usable from server and client components).

- [ ] **Step 1: Create `components/PostCard.tsx`**

Move these verbatim from `BlogIndexContent.tsx` (currently lines 8–18, 65–120): the `BlogPostSummary` interface, `formatDate`, `CategoryChip`, `PostCard`. Add `import Link from "next/link";`. Export all four. Do NOT add `"use client"`.

```tsx
import Link from "next/link";

export interface BlogPostSummary {
  slug: string;
  frontmatter: {
    title: string;
    description: string;
    date: string;
    category: string;
    tags: string[];
  };
  readingTime: string;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CategoryChip({ category }: { category: string }) {
  /* body copied verbatim from BlogIndexContent.tsx lines 73-79 */
}

export function PostCard({
  post,
  featured = false,
}: {
  post: BlogPostSummary;
  featured?: boolean;
}) {
  /* body copied verbatim from BlogIndexContent.tsx lines 81-120 */
}
```

- [ ] **Step 2: Update `BlogIndexContent.tsx`**

Delete the moved code; add `import { PostCard, type BlogPostSummary } from "./components/PostCard";`. (`CategoryChip`/`formatDate` are only used inside `PostCard` — verify with a search before assuming; if `CategoryChip` is referenced elsewhere in the file, import it too.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors (same count as before the change if the baseline isn't clean — verify baseline first with `git stash && npx tsc --noEmit; git stash pop` only if errors appear).

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(blog): extract PostCard/CategoryChip into shared components file" -- "packages/frontend/app/(app)/blog/components/PostCard.tsx" "packages/frontend/app/(app)/blog/BlogIndexContent.tsx"
```

---

### Task 2: `states` frontmatter type + archive helper library (TDD)

**Files:**

- Modify: `packages/frontend/lib/blog/types.ts`
- Modify: `packages/frontend/lib/blog/index.ts:47-53` (loader default)
- Create: `packages/frontend/lib/blog/archive.ts`
- Test: `packages/frontend/lib/blog/__tests__/archive.test.ts`

**Interfaces:**

- Consumes: `BlogPost` from `lib/blog/types.ts`; `STATE_SLUG_DATA`, `SLUG_TO_STATE` from `lib/data/state-slug-data.ts`; `getAllPosts()` from `lib/blog/index.ts`.
- Produces (used by Tasks 4–7):

```ts
export interface ArchiveMonth {
  month: string;
  name: string;
  count: number;
} // month "04", name "April"
export interface ArchiveYear {
  year: string;
  count: number;
  months: ArchiveMonth[];
} // newest year/month first
export interface StateIndexEntry {
  abbrev: string;
  slug: string;
  name: string;
  count: number;
}
export interface StateIndex {
  states: StateIndexEntry[];
  nationalCount: number;
} // states A–Z by name
export const NATIONAL_SLUG = "national";
export function monthName(month: string): string;
export function buildArchiveTree(posts: BlogPost[]): ArchiveYear[];
export function filterPostsByMonth(
  posts: BlogPost[],
  year: string,
  month: string,
): BlogPost[];
export function buildStateIndex(posts: BlogPost[]): StateIndex;
export function filterPostsByStateSlug(
  posts: BlogPost[],
  stateSlug: string,
): BlogPost[];
// Wrappers over getAllPosts():
export function getArchiveTree(): ArchiveYear[];
export function getPostsByMonth(year: string, month: string): BlogPost[];
export function getStateIndex(): StateIndex;
export function getPostsByState(stateSlug: string): BlogPost[];
```

- [ ] **Step 1: Add `states` to the frontmatter type**

In `lib/blog/types.ts`, add to `BlogFrontmatter` (after `tags`):

```ts
  /** USPS state codes this post covers; [] = national/multi-market. */
  states: string[];
```

In `lib/blog/index.ts` `getPostBySlug`, add to the defaults block after the `tags` line:

```ts
    states: Array.isArray(data.states) ? data.states.map(String) : [],
```

- [ ] **Step 2: Write the failing tests**

Create `lib/blog/__tests__/archive.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { BlogPost } from "../types";
import {
  buildArchiveTree,
  filterPostsByMonth,
  buildStateIndex,
  filterPostsByStateSlug,
  monthName,
  NATIONAL_SLUG,
} from "../archive";

function makePost(slug: string, date: string, states: string[]): BlogPost {
  return {
    slug,
    frontmatter: {
      title: slug,
      description: "",
      date,
      author: "PropertyIQ Research",
      category: "market-analysis",
      tags: [],
      states,
      targetKeyword: "",
    },
    content: "",
    readingTime: "1 min read",
  };
}

// getAllPosts() returns newest-first; fixtures mirror that ordering.
const POSTS: BlogPost[] = [
  makePost("july-national", "2026-07-20", []),
  makePost("july-idaho", "2026-07-10", ["ID"]),
  makePost("april-ohio", "2026-04-11", ["OH"]),
  makePost("april-pa-oh", "2026-04-05", ["PA", "OH"]),
  makePost("dec-25-nc", "2025-12-31", ["NC"]),
];

describe("monthName", () => {
  it("maps zero-padded month strings to English names", () => {
    expect(monthName("01")).toBe("January");
    expect(monthName("12")).toBe("December");
  });
});

describe("buildArchiveTree", () => {
  it("groups newest-first by year then month with counts", () => {
    expect(buildArchiveTree(POSTS)).toEqual([
      {
        year: "2026",
        count: 4,
        months: [
          { month: "07", name: "July", count: 2 },
          { month: "04", name: "April", count: 2 },
        ],
      },
      {
        year: "2025",
        count: 1,
        months: [{ month: "12", name: "December", count: 1 }],
      },
    ]);
  });

  it("returns [] for no posts", () => {
    expect(buildArchiveTree([])).toEqual([]);
  });
});

describe("filterPostsByMonth", () => {
  it("returns only posts in that year+month, preserving order", () => {
    const result = filterPostsByMonth(POSTS, "2026", "04");
    expect(result.map((p) => p.slug)).toEqual(["april-ohio", "april-pa-oh"]);
  });

  it("returns [] for a month with no posts", () => {
    expect(filterPostsByMonth(POSTS, "2026", "01")).toEqual([]);
  });
});

describe("buildStateIndex", () => {
  it("counts posts per state A-Z and counts national posts", () => {
    expect(buildStateIndex(POSTS)).toEqual({
      states: [
        { abbrev: "ID", slug: "idaho", name: "Idaho", count: 1 },
        {
          abbrev: "NC",
          slug: "north-carolina",
          name: "North Carolina",
          count: 1,
        },
        { abbrev: "OH", slug: "ohio", name: "Ohio", count: 2 },
        { abbrev: "PA", slug: "pennsylvania", name: "Pennsylvania", count: 1 },
      ],
      nationalCount: 1,
    });
  });
});

describe("filterPostsByStateSlug", () => {
  it("matches by state slug, including multi-state posts", () => {
    const result = filterPostsByStateSlug(POSTS, "ohio");
    expect(result.map((p) => p.slug)).toEqual(["april-ohio", "april-pa-oh"]);
  });

  it("reserves 'national' for empty-states posts", () => {
    const result = filterPostsByStateSlug(POSTS, NATIONAL_SLUG);
    expect(result.map((p) => p.slug)).toEqual(["july-national"]);
  });

  it("returns [] for an unknown slug", () => {
    expect(filterPostsByStateSlug(POSTS, "atlantis")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/blog/__tests__/archive.test.ts`
Expected: FAIL — cannot resolve `../archive`.

- [ ] **Step 4: Implement `lib/blog/archive.ts`**

```ts
import { SLUG_TO_STATE, ABBREV_TO_STATE } from "@/lib/data/state-slug-data";
import { getAllPosts } from "./index";
import type { BlogPost } from "./types";

export interface ArchiveMonth {
  month: string; // "04"
  name: string; // "April"
  count: number;
}

export interface ArchiveYear {
  year: string; // "2026"
  count: number;
  months: ArchiveMonth[]; // newest first
}

export interface StateIndexEntry {
  abbrev: string;
  slug: string;
  name: string;
  count: number;
}

export interface StateIndex {
  states: StateIndexEntry[]; // A–Z by name
  nationalCount: number;
}

/** Reserved /blog/states/* slug for posts with states: []. */
export const NATIONAL_SLUG = "national";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthName(month: string): string {
  return MONTH_NAMES[Number(month) - 1] ?? month;
}

// Dates are ISO "YYYY-MM-DD"; slice instead of Date() to avoid TZ shifts.
const yearOf = (p: BlogPost) => p.frontmatter.date.slice(0, 4);
const monthOf = (p: BlogPost) => p.frontmatter.date.slice(5, 7);

export function buildArchiveTree(posts: BlogPost[]): ArchiveYear[] {
  const years = new Map<string, Map<string, number>>();
  for (const post of posts) {
    const year = yearOf(post);
    const month = monthOf(post);
    const months = years.get(year) ?? new Map<string, number>();
    months.set(month, (months.get(month) ?? 0) + 1);
    years.set(year, months);
  }
  return [...years.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, months]) => {
      const monthEntries = [...months.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, count]) => ({ month, name: monthName(month), count }));
      return {
        year,
        count: monthEntries.reduce((sum, m) => sum + m.count, 0),
        months: monthEntries,
      };
    });
}

export function filterPostsByMonth(
  posts: BlogPost[],
  year: string,
  month: string,
): BlogPost[] {
  return posts.filter((p) => yearOf(p) === year && monthOf(p) === month);
}

export function buildStateIndex(posts: BlogPost[]): StateIndex {
  const counts = new Map<string, number>();
  let nationalCount = 0;
  for (const post of posts) {
    const states = post.frontmatter.states;
    if (states.length === 0) {
      nationalCount++;
      continue;
    }
    for (const abbrev of states) {
      counts.set(abbrev, (counts.get(abbrev) ?? 0) + 1);
    }
  }
  const states = [...counts.entries()]
    .flatMap(([abbrev, count]) => {
      const entry = ABBREV_TO_STATE.get(abbrev);
      return entry ? [{ ...entry, count }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return { states, nationalCount };
}

export function filterPostsByStateSlug(
  posts: BlogPost[],
  stateSlug: string,
): BlogPost[] {
  if (stateSlug === NATIONAL_SLUG) {
    return posts.filter((p) => p.frontmatter.states.length === 0);
  }
  const entry = SLUG_TO_STATE.get(stateSlug);
  if (!entry) return [];
  return posts.filter((p) => p.frontmatter.states.includes(entry.abbrev));
}

export function getArchiveTree(): ArchiveYear[] {
  return buildArchiveTree(getAllPosts());
}

export function getPostsByMonth(year: string, month: string): BlogPost[] {
  return filterPostsByMonth(getAllPosts(), year, month);
}

export function getStateIndex(): StateIndex {
  return buildStateIndex(getAllPosts());
}

export function getPostsByState(stateSlug: string): BlogPost[] {
  return filterPostsByStateSlug(getAllPosts(), stateSlug);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/blog/__tests__/archive.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(blog): states frontmatter type + archive/state facet helpers" -- packages/frontend/lib/blog/types.ts packages/frontend/lib/blog/index.ts packages/frontend/lib/blog/archive.ts packages/frontend/lib/blog/__tests__/archive.test.ts
```

---

### Task 3: Backfill `states` across all 77 posts + corpus validation test

**Files:**

- Create: `packages/frontend/scripts/backfill-post-states.mts`
- Test: `packages/frontend/lib/blog/__tests__/post-states-corpus.test.ts`
- Modify: all `packages/frontend/content/blog/*.mdx` (frontmatter line insertion only)
- Modify: `packages/frontend/content/blog/Blog_rules.md.txt`

**Interfaces:**

- Consumes: `STATE_SLUG_DATA` from `lib/data/state-slug-data.ts`.
- Produces: every post gains a `states:` frontmatter line; the corpus test locks the invariant permanently.

- [ ] **Step 1: Write the failing corpus test**

Create `lib/blog/__tests__/post-states-corpus.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { ABBREV_TO_STATE } from "@/lib/data/state-slug-data";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

describe("blog post states frontmatter (corpus invariant)", () => {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));

  it("has posts to validate", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s declares a valid states array", (file) => {
    const { data } = matter.read(path.join(BLOG_DIR, file));
    expect(data.states, `${file} is missing the states key`).toBeDefined();
    expect(Array.isArray(data.states), `${file} states must be an array`).toBe(
      true,
    );
    for (const code of data.states as unknown[]) {
      expect(typeof code).toBe("string");
      expect(
        ABBREV_TO_STATE.has(code as string),
        `${file} has unknown state code "${code}"`,
      ).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/blog/__tests__/post-states-corpus.test.ts`
Expected: FAIL — 77 posts missing the `states` key.

- [ ] **Step 3: Write the backfill script**

Create `packages/frontend/scripts/backfill-post-states.mts`. It must:

1. Suggest states per post from evidence in priority order: normalized state tags → city tags via `CITY_TO_STATE` → state-name substrings in the filename (longest-first with consumption, so `west-virginia` doesn't also match `virginia`, `arkansas` doesn't match `kansas`).
2. Default (no `--write`) prints a review table: `filename | suggested | evidence`.
3. `--write` inserts a single `states: ["XX"]` line immediately before the closing `---`, touching no other bytes, then re-parses and verifies only `states` changed.

```ts
// Usage (from packages/frontend):
//   npx tsx scripts/backfill-post-states.mts          # dry run: review table
//   npx tsx scripts/backfill-post-states.mts --write  # insert states: [...] lines
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { STATE_SLUG_DATA } from "../lib/data/state-slug-data";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const WRITE = process.argv.includes("--write");

// slug form ("north-carolina") and display form ("north carolina") → abbrev
const NAME_TO_ABBREV = new Map<string, string>();
for (const s of STATE_SLUG_DATA) {
  NAME_TO_ABBREV.set(s.slug, s.abbrev);
  NAME_TO_ABBREV.set(s.name.toLowerCase(), s.abbrev);
}

// City/metro tags appearing in the corpus without a state tag.
// Filled in during dry-run review (Step 4).
const CITY_TO_STATE: Record<string, string> = {};

// Manual verdicts that beat all heuristics. [] = national. Filled in Step 4.
const OVERRIDES: Record<string, string[]> = {};

const normalizeTag = (tag: string) =>
  tag.toLowerCase().trim().replace(/\s+/g, "-");

// Longest-first + consumption so "west-virginia" wins over "virginia".
const SLUG_SCAN_ORDER = [...STATE_SLUG_DATA].sort(
  (a, b) => b.slug.length - a.slug.length,
);

function suggest(filename: string, tags: string[]) {
  const base = filename.replace(/\.mdx$/, "");
  if (base in OVERRIDES) {
    return { states: OVERRIDES[base], evidence: ["override"] };
  }
  const found = new Map<string, string>(); // abbrev -> evidence
  for (const tag of tags) {
    const abbrev = NAME_TO_ABBREV.get(normalizeTag(tag));
    if (abbrev && !found.has(abbrev)) found.set(abbrev, `state-tag:${tag}`);
  }
  for (const tag of tags) {
    const abbrev = CITY_TO_STATE[normalizeTag(tag)];
    if (abbrev && !found.has(abbrev)) found.set(abbrev, `city-tag:${tag}`);
  }
  let scan = base.toLowerCase();
  for (const s of SLUG_SCAN_ORDER) {
    if (scan.includes(s.slug)) {
      if (!found.has(s.abbrev)) found.set(s.abbrev, `slug:${s.slug}`);
      scan = scan.split(s.slug).join(" ");
    }
  }
  return {
    states: [...found.keys()].sort(),
    evidence: [...found.values()],
  };
}

function insertStatesLine(raw: string, states: string[]): string {
  if (!raw.startsWith("---")) throw new Error("no frontmatter");
  const close = raw.indexOf("\n---", 3);
  if (close === -1) throw new Error("unterminated frontmatter");
  const line =
    states.length === 0
      ? "\nstates: []"
      : `\nstates: [${states.map((s) => `"${s}"`).join(", ")}]`;
  return raw.slice(0, close) + line + raw.slice(close);
}

const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
let written = 0;
for (const file of files) {
  const fullPath = path.join(BLOG_DIR, file);
  const raw = fs.readFileSync(fullPath, "utf-8");
  const before = matter(raw);
  if (before.data.states !== undefined) {
    console.log(`SKIP (has states)  ${file}`);
    continue;
  }
  const tags: string[] = Array.isArray(before.data.tags)
    ? before.data.tags
    : [];
  const { states, evidence } = suggest(file, tags);
  console.log(
    `${file.padEnd(70)} [${states.join(", ").padEnd(10)}] ${evidence.join("; ") || "none -> national"}`,
  );
  if (!WRITE) continue;

  const updated = insertStatesLine(raw, states);
  const after = matter(updated);
  const beforeKeys = JSON.stringify(before.data);
  const { states: _s, ...afterRest } = after.data;
  if (
    JSON.stringify(afterRest) !== beforeKeys ||
    after.content !== before.content
  ) {
    throw new Error(`frontmatter corruption detected in ${file} — aborting`);
  }
  fs.writeFileSync(fullPath, updated);
  written++;
}
console.log(
  WRITE
    ? `\nWrote states to ${written} files.`
    : "\nDry run only — pass --write to apply.",
);
```

- [ ] **Step 4: Dry run, review, fill the maps**

Run: `npx tsx scripts/backfill-post-states.mts`

Review all 77 rows against titles/slugs. For every city-only post (e.g. `cleveland`, `pittsburgh`, `boise`), add the city → state code to `CITY_TO_STATE`. For posts the heuristics get wrong (e.g. a "best market by state" national roundup that picks up a stray state from its slug), add an `OVERRIDES` entry. Re-run the dry run until every row's suggestion is correct. **Present the final table summary to the user in the conversation (counts per state + list of national posts) — this is the review gate promised in the spec.**

- [ ] **Step 5: Apply and verify**

Run: `npx tsx scripts/backfill-post-states.mts --write`
Then: `npx vitest run lib/blog/__tests__/post-states-corpus.test.ts`
Expected: PASS. Also run `git diff --stat -- content/blog` and confirm every file shows exactly `1 insertion(+), 0 deletions(-)`.

- [ ] **Step 6: Document the rule for future posts**

In `packages/frontend/content/blog/Blog_rules.md.txt`, add to the frontmatter rules section (read the file first, match its formatting):

```
- states (REQUIRED): USPS codes for each state the post covers, e.g. states: ["OH", "PA"].
  National or multi-market posts with no single-state focus use states: [].
  Valid codes are the 50 states + DC + PR (see packages/frontend/lib/data/state-slug-data.ts).
```

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/content/blog packages/frontend/scripts/backfill-post-states.mts packages/frontend/lib/blog/__tests__/post-states-corpus.test.ts
git commit -m "content(blog): backfill states frontmatter across all posts + corpus invariant test" -- packages/frontend/content/blog packages/frontend/scripts/backfill-post-states.mts packages/frontend/lib/blog/__tests__/post-states-corpus.test.ts
```

---

### Task 4: Date archive routes

**Files:**

- Create: `packages/frontend/app/(app)/blog/archive/page.tsx`
- Create: `packages/frontend/app/(app)/blog/archive/[year]/page.tsx`
- Create: `packages/frontend/app/(app)/blog/archive/[year]/[month]/page.tsx`

**Interfaces:**

- Consumes: `getArchiveTree`, `getPostsByMonth`, `monthName`, `filterPostsByMonth` (Task 2); `PostCard`, `BlogPostSummary` (Task 1); `getAllPosts` from `@/lib/blog`; `PageHeaderWithBreadcrumbs` from `@/components/navigation`.
- Produces: routes `/blog/archive`, `/blog/archive/[year]`, `/blog/archive/[year]/[month]`.

Shared conventions for all three pages: server components (no `"use client"`); `notFound()` when the param resolves to zero posts; canonical URLs on `https://www.propertyiq.app`; posts mapped to the same summary shape the index uses:

```ts
const toSummary = (post: BlogPost): BlogPostSummary => ({
  slug: post.slug,
  frontmatter: {
    title: post.frontmatter.title,
    description: post.frontmatter.description,
    date: post.frontmatter.date,
    category: post.frontmatter.category,
    tags: post.frontmatter.tags,
  },
  readingTime: post.readingTime,
});
```

- [ ] **Step 1: Create `/blog/archive` page**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { getArchiveTree } from "@/lib/blog/archive";

export const metadata: Metadata = {
  title: "Blog Archive by Date",
  description:
    "Browse every PropertyIQ housing market analysis by publication month.",
  alternates: { canonical: "https://www.propertyiq.app/blog/archive" },
};

export default function BlogArchiveIndexPage() {
  const tree = getArchiveTree();

  return (
    <div className="min-h-screen">
      <PageHeaderWithBreadcrumbs
        breadcrumbs={[{ label: "Blog", href: "/blog" }, { label: "Archive" }]}
        title="Blog Archive"
        description="Every post, organized by publication month."
        icon={<CalendarDays className="w-5 h-5" />}
      />
      <div className="mt-8 space-y-8">
        {tree.map((year) => (
          <section key={year.year}>
            <h2 className="text-lg font-semibold text-on-surface mb-3">
              <Link
                href={`/blog/archive/${year.year}`}
                className="hover:text-primary transition-colors"
              >
                {year.year}
              </Link>{" "}
              <span className="text-on-surface-variant font-normal text-sm">
                ({year.count})
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {year.months.map((m) => (
                <Link
                  key={m.month}
                  href={`/blog/archive/${year.year}/${m.month}`}
                  className="inline-flex items-center px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-sm font-medium hover:shadow-sm transition-shadow"
                >
                  {m.name} ({m.count})
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
```

(Check `PageHeaderWithBreadcrumbs` prop shape before use — the blog index passes `breadcrumbs={[{ label: "Blog" }]}`; confirm intermediate crumbs take `href`.)

- [ ] **Step 2: Create `/blog/archive/[year]` page**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { getAllPosts, type BlogPost } from "@/lib/blog";
import {
  getArchiveTree,
  filterPostsByMonth,
  monthName,
} from "@/lib/blog/archive";
import { PostCard, type BlogPostSummary } from "../../components/PostCard";

interface YearPageProps {
  params: Promise<{ year: string }>;
}

export function generateStaticParams() {
  return getArchiveTree().map(({ year }) => ({ year }));
}

export async function generateMetadata({
  params,
}: YearPageProps): Promise<Metadata> {
  const { year } = await params;
  return {
    title: `${year} Blog Archive`,
    description: `PropertyIQ housing market analysis published in ${year}.`,
    alternates: {
      canonical: `https://www.propertyiq.app/blog/archive/${year}`,
    },
  };
}

const toSummary = (post: BlogPost): BlogPostSummary => ({
  slug: post.slug,
  frontmatter: {
    title: post.frontmatter.title,
    description: post.frontmatter.description,
    date: post.frontmatter.date,
    category: post.frontmatter.category,
    tags: post.frontmatter.tags,
  },
  readingTime: post.readingTime,
});

export default async function BlogArchiveYearPage({ params }: YearPageProps) {
  const { year } = await params;
  const yearEntry = getArchiveTree().find((y) => y.year === year);
  if (!yearEntry) notFound();

  const posts = getAllPosts();

  return (
    <div className="min-h-screen">
      <PageHeaderWithBreadcrumbs
        breadcrumbs={[
          { label: "Blog", href: "/blog" },
          { label: "Archive", href: "/blog/archive" },
          { label: year },
        ]}
        title={`${year} Archive`}
        description={`${yearEntry.count} post${yearEntry.count !== 1 ? "s" : ""} published in ${year}.`}
        icon={<CalendarDays className="w-5 h-5" />}
      />
      <div className="mt-8 space-y-10">
        {yearEntry.months.map((m) => (
          <section key={m.month}>
            <h2 className="text-lg font-semibold text-on-surface mb-4">
              {m.name} {year}{" "}
              <span className="text-on-surface-variant font-normal text-sm">
                ({m.count})
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterPostsByMonth(posts, year, m.month).map((post) => (
                <PostCard key={post.slug} post={toSummary(post)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `/blog/archive/[year]/[month]` page**

Same imports/`toSummary` as Step 2 (adjust relative path to `../../../components/PostCard`).

```tsx
interface MonthPageProps {
  params: Promise<{ year: string; month: string }>;
}

export function generateStaticParams() {
  return getArchiveTree().flatMap((y) =>
    y.months.map((m) => ({ year: y.year, month: m.month })),
  );
}

export async function generateMetadata({
  params,
}: MonthPageProps): Promise<Metadata> {
  const { year, month } = await params;
  const label = `${monthName(month)} ${year}`;
  return {
    title: `${label} Blog Archive`,
    description: `PropertyIQ housing market analysis published in ${label}.`,
    alternates: {
      canonical: `https://www.propertyiq.app/blog/archive/${year}/${month}`,
    },
  };
}

export default async function BlogArchiveMonthPage({ params }: MonthPageProps) {
  const { year, month } = await params;
  const posts = getPostsByMonth(year, month);
  if (posts.length === 0) notFound();

  const label = `${monthName(month)} ${year}`;

  return (
    <div className="min-h-screen">
      <PageHeaderWithBreadcrumbs
        breadcrumbs={[
          { label: "Blog", href: "/blog" },
          { label: "Archive", href: "/blog/archive" },
          { label: year, href: `/blog/archive/${year}` },
          { label: monthName(month) },
        ]}
        title={`${label} Archive`}
        description={`${posts.length} post${posts.length !== 1 ? "s" : ""} published in ${label}.`}
        icon={<CalendarDays className="w-5 h-5" />}
      />
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post) => (
          <PostCard key={post.slug} post={toSummary(post)} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify in dev**

Run the dev server (or reuse the running one) and check:

- `/blog/archive` lists 2026 with Feb/Mar/Apr/Jun/Jul chips and correct counts.
- `/blog/archive/2026/04` shows 52 posts.
- `/blog/archive/2026/01` returns 404.
- `/blog/archive/1999` returns 404.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(blog): date archive pages /blog/archive/[year]/[month]" -- "packages/frontend/app/(app)/blog/archive"
```

---

### Task 5: State browse routes

**Files:**

- Create: `packages/frontend/app/(app)/blog/states/page.tsx`
- Create: `packages/frontend/app/(app)/blog/states/[state]/page.tsx`

**Interfaces:**

- Consumes: `getStateIndex`, `getPostsByState`, `NATIONAL_SLUG` (Task 2); `SLUG_TO_STATE` from `@/lib/data/state-slug-data`; `PostCard`/`toSummary` pattern from Task 4.
- Produces: routes `/blog/states`, `/blog/states/[state]` (including `/blog/states/national`).

- [ ] **Step 1: Create `/blog/states` page**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { getStateIndex, NATIONAL_SLUG } from "@/lib/blog/archive";

export const metadata: Metadata = {
  title: "Blog Posts by State",
  description: "Browse PropertyIQ housing market analysis by U.S. state.",
  alternates: { canonical: "https://www.propertyiq.app/blog/states" },
};

export default function BlogStatesIndexPage() {
  const { states, nationalCount } = getStateIndex();

  return (
    <div className="min-h-screen">
      <PageHeaderWithBreadcrumbs
        breadcrumbs={[{ label: "Blog", href: "/blog" }, { label: "By State" }]}
        title="Blog Posts by State"
        description="Market analysis organized by the states each post covers."
        icon={<MapPin className="w-5 h-5" />}
      />
      <div className="mt-8 flex flex-wrap gap-2">
        {states.map((s) => (
          <Link
            key={s.abbrev}
            href={`/blog/states/${s.slug}`}
            className="inline-flex items-center px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-sm font-medium hover:shadow-sm transition-shadow"
          >
            {s.name} ({s.count})
          </Link>
        ))}
        {nationalCount > 0 && (
          <Link
            href={`/blog/states/${NATIONAL_SLUG}`}
            className="inline-flex items-center px-3 py-1 rounded-full bg-surface-container-high text-on-surface text-sm font-medium hover:shadow-sm transition-shadow"
          >
            National &amp; Multi-Market ({nationalCount})
          </Link>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `/blog/states/[state]` page**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import type { BlogPost } from "@/lib/blog";
import {
  getStateIndex,
  getPostsByState,
  NATIONAL_SLUG,
} from "@/lib/blog/archive";
import { SLUG_TO_STATE } from "@/lib/data/state-slug-data";
import { PostCard, type BlogPostSummary } from "../../components/PostCard";

interface StatePageProps {
  params: Promise<{ state: string }>;
}

export function generateStaticParams() {
  const { states, nationalCount } = getStateIndex();
  const params = states.map((s) => ({ state: s.slug }));
  if (nationalCount > 0) params.push({ state: NATIONAL_SLUG });
  return params;
}

function displayName(stateSlug: string): string {
  if (stateSlug === NATIONAL_SLUG) return "National & Multi-Market";
  return SLUG_TO_STATE.get(stateSlug)?.name ?? stateSlug;
}

export async function generateMetadata({
  params,
}: StatePageProps): Promise<Metadata> {
  const { state } = await params;
  const name = displayName(state);
  return {
    title: `${name} Real Estate Blog Posts`,
    description: `PropertyIQ housing market analysis covering ${name}.`,
    alternates: {
      canonical: `https://www.propertyiq.app/blog/states/${state}`,
    },
  };
}

const toSummary = (post: BlogPost): BlogPostSummary => ({
  slug: post.slug,
  frontmatter: {
    title: post.frontmatter.title,
    description: post.frontmatter.description,
    date: post.frontmatter.date,
    category: post.frontmatter.category,
    tags: post.frontmatter.tags,
  },
  readingTime: post.readingTime,
});

export default async function BlogStatePage({ params }: StatePageProps) {
  const { state } = await params;
  const posts = getPostsByState(state);
  if (posts.length === 0) notFound();

  const name = displayName(state);

  return (
    <div className="min-h-screen">
      <PageHeaderWithBreadcrumbs
        breadcrumbs={[
          { label: "Blog", href: "/blog" },
          { label: "By State", href: "/blog/states" },
          { label: name },
        ]}
        title={`${name} Posts`}
        description={`${posts.length} post${posts.length !== 1 ? "s" : ""} covering ${name}.`}
        icon={<MapPin className="w-5 h-5" />}
      />
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post) => (
          <PostCard key={post.slug} post={toSummary(post)} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify in dev**

- `/blog/states` shows an A–Z chip list plus National, with counts summing sensibly (state counts + national ≥ 77 — multi-state posts count more than once).
- `/blog/states/ohio` lists the Ohio posts.
- `/blog/states/national` lists national posts.
- `/blog/states/atlantis` returns 404.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(blog): state browse pages /blog/states/[state]" -- "packages/frontend/app/(app)/blog/states"
```

---

### Task 6: "Browse the archive" panel on the blog index

**Files:**

- Create: `packages/frontend/app/(app)/blog/components/BlogBrowsePanel.tsx`
- Modify: `packages/frontend/app/(app)/blog/page.tsx` (compute + pass props)
- Modify: `packages/frontend/app/(app)/blog/BlogIndexContent.tsx` (render panel)

**Interfaces:**

- Consumes: `ArchiveYear`, `StateIndex`, `NATIONAL_SLUG`, `monthName` via **`import type` / value imports from `@/lib/blog/archive`** — the panel is bundled client-side, so import ONLY types plus `NATIONAL_SLUG` (a string constant); do not import functions that pull in `fs`.
- Produces: `BlogBrowsePanel({ tree, stateIndex })`; `BlogIndexContent` gains props `archiveTree: ArchiveYear[]`, `stateIndex: StateIndex`.

**Before writing any UI in this task, invoke the `frontend-design:frontend-design` skill (saved user feedback: always invoke it before UI changes).**

- [ ] **Step 1: Create `BlogBrowsePanel.tsx`**

Import note: `NATIONAL_SLUG` and `monthName` live in `@/lib/blog/archive`, which imports `./index` (fs). To keep the client bundle clean, re-derive locally instead of importing values:

```tsx
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import type { ArchiveYear, StateIndex } from "@/lib/blog/archive";

export function BlogBrowsePanel({
  tree,
  stateIndex,
}: {
  tree: ArchiveYear[];
  stateIndex: StateIndex;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-on-surface mb-4">
        Browse the archive
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface-container-low rounded-xl border border-outline-variant/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-on-surface-variant" />
            <h3 className="text-sm font-semibold text-on-surface">
              <Link
                href="/blog/archive"
                className="hover:text-primary transition-colors"
              >
                By date
              </Link>
            </h3>
          </div>
          <div className="space-y-3">
            {tree.map((year) => (
              <div key={year.year}>
                <Link
                  href={`/blog/archive/${year.year}`}
                  className="text-sm font-medium text-on-surface hover:text-primary transition-colors"
                >
                  {year.year} ({year.count})
                </Link>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {year.months.map((m) => (
                    <Link
                      key={m.month}
                      href={`/blog/archive/${year.year}/${m.month}`}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container text-xs font-medium hover:shadow-sm transition-shadow"
                    >
                      {m.name.slice(0, 3)} ({m.count})
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-low rounded-xl border border-outline-variant/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-on-surface-variant" />
            <h3 className="text-sm font-semibold text-on-surface">
              <Link
                href="/blog/states"
                className="hover:text-primary transition-colors"
              >
                By state
              </Link>
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stateIndex.states.map((s) => (
              <Link
                key={s.abbrev}
                href={`/blog/states/${s.slug}`}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container text-xs font-medium hover:shadow-sm transition-shadow"
              >
                {s.name} ({s.count})
              </Link>
            ))}
            {stateIndex.nationalCount > 0 && (
              <Link
                href="/blog/states/national"
                className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface text-xs font-medium hover:shadow-sm transition-shadow"
              >
                National ({stateIndex.nationalCount})
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

(Adjust styling per frontend-design skill guidance — the code above is the baseline, not a license to skip the skill.)

- [ ] **Step 2: Wire data through `page.tsx`**

In `app/(app)/blog/page.tsx`: add `import { getArchiveTree, getStateIndex } from "@/lib/blog/archive";`, compute both after `getAllPosts()`, and pass:

```tsx
<BlogIndexContent
  posts={postSummaries}
  archiveTree={getArchiveTree()}
  stateIndex={getStateIndex()}
/>
```

- [ ] **Step 3: Render in `BlogIndexContent.tsx`**

Extend the props signature and render the panel in the unfiltered branch, after the Latest section and before `GROUP_ORDER.map(...)`:

```tsx
import type { ArchiveYear, StateIndex } from "@/lib/blog/archive";
import { BlogBrowsePanel } from "./components/BlogBrowsePanel";

export function BlogIndexContent({
  posts,
  archiveTree,
  stateIndex,
}: {
  posts: BlogPostSummary[];
  archiveTree: ArchiveYear[];
  stateIndex: StateIndex;
}) {
  // ... existing body ...
  //   <BlogBrowsePanel tree={archiveTree} stateIndex={stateIndex} />
}
```

- [ ] **Step 4: Verify in dev**

`/blog` shows the two-card panel below Latest; panel disappears when a market chip or keyword filter is active; every link navigates to a working page. Check both light and dark mode (no hardcoded colors). Confirm `BlogIndexContent.tsx` is still under 400 lines (`(Get-Content ... | Measure-Object -Line).Lines` or `wc -l`).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(blog): browse-the-archive panel on blog index" -- "packages/frontend/app/(app)/blog/components/BlogBrowsePanel.tsx" "packages/frontend/app/(app)/blog/page.tsx" "packages/frontend/app/(app)/blog/BlogIndexContent.tsx"
```

---

### Task 7: Sitemap registration + full verification

**Files:**

- Modify: `packages/frontend/lib/seo/sitemap-builder.ts` (inside/next to `buildMainUrls`, lines 84–123)

**Interfaces:**

- Consumes: `getArchiveTree`, `getStateIndex`, `getPostsByMonth`, `getPostsByState`, `NATIONAL_SLUG` (Task 2); existing `isoOrUndefined`, `BASE_URL`, `getAllPosts`.
- Produces: facet URLs in the main sitemap with honest `<lastmod>` (newest post in each bucket — matches the file's no-fabricated-dates policy).

- [ ] **Step 1: Add facet URLs to the sitemap**

Add a helper and spread it into `buildMainUrls`'s return between `blogRoutes` and `comparisonRoutes`:

```ts
import {
  getArchiveTree,
  getStateIndex,
  getPostsByMonth,
  getPostsByState,
  NATIONAL_SLUG,
} from "@/lib/blog/archive";

// Facet pages carry the newest contained post's date as an honest <lastmod>.
function buildBlogFacetUrls(): SitemapUrl[] {
  const posts = getAllPosts();
  if (posts.length === 0) return [];
  const urls: SitemapUrl[] = [];
  const newestOverall = isoOrUndefined(posts[0].frontmatter.date);

  urls.push({ loc: `${BASE_URL}/blog/archive`, lastmod: newestOverall });
  for (const year of getArchiveTree()) {
    const newestInYear = posts.find((p) =>
      p.frontmatter.date.startsWith(year.year),
    );
    urls.push({
      loc: `${BASE_URL}/blog/archive/${year.year}`,
      lastmod: isoOrUndefined(newestInYear?.frontmatter.date),
    });
    for (const m of year.months) {
      urls.push({
        loc: `${BASE_URL}/blog/archive/${year.year}/${m.month}`,
        lastmod: isoOrUndefined(
          getPostsByMonth(year.year, m.month)[0]?.frontmatter.date,
        ),
      });
    }
  }

  const { states, nationalCount } = getStateIndex();
  urls.push({ loc: `${BASE_URL}/blog/states`, lastmod: newestOverall });
  for (const s of states) {
    urls.push({
      loc: `${BASE_URL}/blog/states/${s.slug}`,
      lastmod: isoOrUndefined(getPostsByState(s.slug)[0]?.frontmatter.date),
    });
  }
  if (nationalCount > 0) {
    urls.push({
      loc: `${BASE_URL}/blog/states/${NATIONAL_SLUG}`,
      lastmod: isoOrUndefined(
        getPostsByState(NATIONAL_SLUG)[0]?.frontmatter.date,
      ),
    });
  }
  return urls;
}
```

```ts
return [
  ...staticRoutes,
  ...blogRoutes,
  ...buildBlogFacetUrls(),
  ...comparisonRoutes,
];
```

- [ ] **Step 2: Run the full frontend test suite for touched areas**

Run: `npx vitest run lib/blog lib/seo`
Expected: PASS (archive tests, corpus test, existing seo tests). Note: some unrelated suite files are env-gated/failing by default — scoping to `lib/blog lib/seo` avoids that noise.

- [ ] **Step 3: Typecheck + production build**

Run: `npx tsc --noEmit` — expect clean.
Run: `npm run build` (if OOM, retry with `NODE_OPTIONS=--max-old-space-size=4096`).
Expected: build succeeds; output lists `/blog/archive`, `/blog/archive/[year]`, `/blog/archive/[year]/[month]`, `/blog/states`, `/blog/states/[state]` as prerendered (● SSG), with 1 year, 5 month, ~20+ state params.

- [ ] **Step 4: Spot-check the built app (200 ≠ rendered — check content)**

Start the built app on a spare port: `npx next start -p 3100`, then verify each page body contains expected content (not just status 200):

- `/blog/archive` contains "April" and "(52)".
- `/blog/archive/2026/04` contains a known April title (e.g. "Cleveland Real Estate Market 2026").
- `/blog/states/ohio` contains "Cleveland" or "Columbus".
- `/blog/states/national` renders with ≥1 card.
- `/sitemap.xml` output includes `/blog/archive/2026/04` and `/blog/states/ohio`.
  Stop the server afterwards.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(seo): blog archive + state facet pages in sitemap" -- packages/frontend/lib/seo/sitemap-builder.ts
```

---

## Post-plan

- Dispatch background validation agents per CLAUDE.md §1.6 (`code-reviewer`, `file-size-compliance` for touched files).
- Do NOT push; work stays local on `develop` unless Troy asks.
- Publishing note: blog content normally ships via `npm run blog:publish`, but this change is code + content together — it rides the normal `develop → main` release flow (`npm run release:main`), not the blog worktree publisher.
