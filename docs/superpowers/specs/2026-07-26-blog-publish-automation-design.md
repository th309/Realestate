# Blog Publish Automation — Design

**Date:** 2026-07-26
**Status:** Approved (one-command trigger + content-only-to-main both chosen by Troy)

## Problem

Blog posts are MDX files in `packages/frontend/content/blog`, read from the filesystem
by `lib/blog/index.ts`. Production serves a baked standalone build on Railway, so a
file in that folder reaches readers only after: commit → push → release to `main` →
Railway rebuild. Nothing automates that chain; every past batch was published by hand.
Additionally, `getAllPosts()` caches the post list in memory in production, and posts
with a future frontmatter `date` are silently filtered out.

A full `release:main` is the wrong vehicle for content: it ships **all** of `develop`,
including unfinished code.

## Decision

`npm run blog:publish` → `scripts/git/publish-blog.sh`. One command, and running it is
explicit consent to push `main`. Content-only commits go **directly onto `main`** via a
temporary worktree (the user's working tree never changes branches); code releases
remain a separate, deliberate act via `release:main`.

## Flow

1. **Guards** — current branch is `develop`; local `develop` not behind `origin/develop`;
   local `main` not diverged from `origin/main`.
2. **Collect** — added / modified / deleted `*.mdx` at the top level of
   `content/blog` (drafts/ never publishes; the blog lib does not read it).
3. **Validate** (added/modified only) — frontmatter must have `title` and `date`;
   future-dated posts are warned and excluded (they would deploy invisible);
   retired coverage-count claims (the "400+ markets" bug class) are a hard failure.
4. **Commit on `develop`** — `git add` exactly the validated files, then an atomic
   pathspec commit (`git commit -m … -- <files>`), never sweeping parallel WIP.
5. **Publish via temp worktree of `main`** — fast-forward local `main` to
   `origin/main`; in the worktree, mirror `develop`'s tracked `content/blog` tree
   (rm -rf + checkout + `add -A`, so deletions propagate), commit
   `content(blog): publish <slugs>`, push `origin main`. Railway rebuilds.
6. **Back-merge `main` into `develop`** locally (clean by construction) and verify:
   `git rev-list --count develop..origin/main` is 0, and the
   `content/blog` subtree SHAs on `develop` and `main` are identical.
   `develop` is **not** pushed (that would publish unrelated WIP commits).
7. **Verify live** — for each new slug, poll `https://www.propertyiq.app/blog/<slug>`
   until HTTP 200 (≤10 min). Modified/deleted-only publishes get a note instead
   (a 200 there proves nothing about the new build).

`--dry-run` performs steps 1–3 and prints the plan, mutating nothing.
`--no-verify-live` skips step 7.

## Error handling

Any failure before the push aborts with the repo state named explicitly. The worktree
is removed on exit via trap. Index-contention (`index.lock` from parallel sessions)
gets a short retry.

## Out of scope (deliberate)

Scheduling/future publish dates, draft workflow, AI generation (content-pipeline lane
territory), and any change to `lib/blog/index.ts` — every publish ships a fresh build,
so the runtime cache behavior is irrelevant to this path.
