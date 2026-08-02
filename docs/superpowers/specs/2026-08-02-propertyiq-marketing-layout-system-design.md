# PropertyIQ Marketing + Blog Layout System

**Date:** 2026-08-02
**Status:** Draft for review
**Scope:** Public marketing surfaces (homepage, blog, pricing, about, contact) and the shared layout primitives they depend on. The authed app (`/dashboard`, `/map`, `/market/[id]`) is explicitly out of scope for this pass.

---

## Context

The stated goal is for PropertyIQ's public surfaces to read as cleanly as propertywiz.ai. Direct visual comparison of both sites (marketing home, pricing, and — for PropertyWiz — the logged-in dashboard, deal analyzer, and discovery map) shows the gap is not taste or missing sections. It is the absence of a shared layout contract, plus a habit of using saturated colour as a background field rather than as an accent.

Measured state of `packages/frontend`:

| Symptom                               | Measurement                                                                |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Container widths across marketing     | six (`max-w-2xl` … `max-w-7xl`)                                            |
| H1 type scales                        | five                                                                       |
| Horizontal gutters                    | `px-4` in `(public)`, `px-6` in `(app)` — split by route group, not design |
| Homepage vertical rhythms             | 12 distinct per-section paddings                                           |
| Hardcoded hex literals                | 604 across 119 files (`#3949AB` ×124, `#00C853` ×42, `#1A237E` ×36)        |
| Radii off the 3-token scale           | ~1,418 of 3,554 (~40%)                                                     |
| Elevation systems in use              | two — 353 `shadow-*` and 77 `elevation-*`                                  |
| `<Button>` / `<Card>` primitive usage | **0 import sites**; 961 raw `<button>` elements instead                    |
| `dark:` variant coverage              | 31 of 1,384 files; zero in home, blog, or magnet-landing                   |

Two findings reframe the work:

1. **The design system already exists and is good.** `app/globals.css` defines a complete M3 token set — full surface ladder, outline variants, primary/secondary/tertiary containers, error/warning, M3 easing curves, and `--font-sans` / `--font-serif` / `--font-mono`. Dark mode is wired via `prefers-color-scheme`. The pages simply bypass it.
2. **Production serves homepage variant B, not variant A.** The live hero is `app/components/home/landing-v2/BeatHero.tsx` ("THE FORECAST, FIRST / Seattle, WA scores 16. Buffalo, NY scores 98."). The 13-section `app/(app)/page.tsx` is variant A and is not what visitors see. Redesigning A would change nothing.

## Reference analysis: what makes PropertyWiz read clean

Six rules, derived from observation of their live marketing and app surfaces.

1. **The canvas is always light.** Marketing alternates white and light-grey section bands. The app is a light-grey canvas with white cards. Dark is used once — the dashboard hero — as a _contained rounded card with light gutters_, never as a page background.
2. **Colour is an accent, never a fill.** One indigo primary for CTAs and active states; one teal secondary for a two-word gradient and active outlines. Semantic colour appears only as ~18px rounded icon tiles beside labels and as 3px left-border stripes on KPI cards.
3. **Numbers are monospace; labels are uppercase micro-grey.** Every KPI tile is one repeated unit: 11px uppercase grey label / large mono value / 11px grey caption.
4. **Separation is surface plus air, never gradient.** White card, 1px neutral border, minimal shadow, consistent generous padding. No gradients on cards, no glassmorphism, no decorative blobs.
5. **Chips carry navigation and taxonomy.** One rounded-full pill component with a colour icon tile serves the hero feature switcher, analyser tabs, filter bar, and saved-property filters.
6. **One primary action per screen.**

Rule 3 is already PropertyIQ policy — CLAUDE.md §8.3 designates Roboto Mono for numbers, scores, and metrics — and is simply not executed.

## Design

### 1. Layout contract

A single set of constants, defined once and imported. No page picks its own.

| Token          | Value                              | Applies to                    |
| -------------- | ---------------------------------- | ----------------------------- |
| Content width  | `max-w-6xl` (1152px)               | All marketing sections        |
| Prose width    | `max-w-3xl` (768px)                | Blog post body, legal copy    |
| Gutter         | `px-6 lg:px-8`                     | Everything, both route groups |
| Section rhythm | `py-20 lg:py-28`                   | Standard section              |
| Tight rhythm   | `py-12 lg:py-16`                   | Dense/utility sections        |
| H1             | `text-4xl md:text-5xl lg:text-6xl` | One scale, all pages          |
| H2             | `text-3xl md:text-4xl`             | One scale, all pages          |
| H3             | `text-xl md:text-2xl`              | One scale, all pages          |

Two rhythms and three heading scales — down from twelve and five.

### 2. Surface model

Sections alternate between exactly two surfaces. This replaces the page-wide gradient.

- **Band A:** `bg-surface` (near-white)
- **Band B:** `bg-surface-container-low` (light grey)
- **Cards:** `bg-surface` with `border border-outline-variant`, `rounded-xl`, `shadow-sm`
- **Dark treatment:** permitted only as a _contained_ `rounded-2xl` panel inset within a light band — never as a section or page background

Every colour comes from a semantic token. No hex literals in marketing components.

### 3. Primitives to build

New, in `packages/frontend/app/components/marketing/`:

| Primitive         | Purpose                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `Section`         | Applies band surface, rhythm, container width, gutter. Props: `surface`, `rhythm`.                                    |
| `SectionHeading`  | Eyebrow + H2 + optional subhead at fixed scales.                                                                      |
| `ScreenshotFrame` | Bordered, rounded product-image container with consistent aspect handling.                                            |
| `StatTile`        | Uppercase micro-label / mono value / grey caption. Optional accent stripe.                                            |
| `Chip`            | Rounded-full pill with optional icon tile. Variants: `static`, `nav`, `filter`. Replaces ~11 local reimplementations. |
| `PostCard`        | Blog card with image slot, category chip, date, reading time, description.                                            |

Revive rather than rebuild: `components/ui/Button.tsx` and `components/ui/Card.tsx` already implement the needed variants and have zero import sites. Marketing adopts them; the 961 raw `<button>` elements are out of scope except within files this work already touches.

### 4. Homepage (variant B)

Rebuild `landing-v2` onto the contract above.

- Light canvas; the current full-viewport indigo becomes a contained dark panel or is dropped
- Hero: asymmetric split — copy left, real product screenshot right, sourced from the existing `public/images/home/` assets (`market-map-hero-v4.png`, `market-scores-detail-v2.png`, `ai-report-narrative-v2.png`, `top-ranked-markets-v2.png`)
- Hero copy cut to roughly a quarter of current word count; the Seattle-vs-Buffalo contrast survives as headline plus a short subhead, with the two ~100-word narrative cards moved below the fold
- One primary CTA
- Score values rendered in `--font-mono` per §8.3
- Delete variant A (`app/(app)/page.tsx` and its unused section components) and the A/B rewrite machinery

### 5. Blog

The blog is the cleanest code in the repo (zero `bg-white`, zero hex, token-only) but was never designed.

- Add an optional `image` field to post frontmatter
- Generate hero images for the 77 existing posts using the existing content-pipeline headless-Chromium PNG renderer rather than sourcing photography
- `PostCard` gains an image slot; description shows on all cards, not only `featured`
- Post body adopts `--font-serif` (Source Serif 4) per §8.3, replacing bare `prose prose-lg`
- Fix the double-pad: `blog/layout.tsx` and `blog/[slug]/page.tsx` both apply `px-4 py-*`

### 6. Correctness fixes folded in

These are defects found during the audit, not scope creep — each sits in a file this work already edits.

- `HeroSection.tsx:48` says "0–100 score"; the scale is 1–99
- `about/page.tsx` claims a solo founder in one section and "a team of data scientists" in the next
- `FeatureShowcaseInsights.tsx` hardcodes "+12% excess returns" instead of sourcing from `lib/data/validation-claims.ts`
- `pricing/layout.tsx:142-144` renders the FAQ above page content; every other page renders it last
- `about/page.tsx` is 408 lines, over the 400-line limit
- Pricing feature showcase displays fabricated Nashville figures while a live scoring API is available

## Sequencing

1. Layout contract constants + `Section` / `SectionHeading` / `Chip` / `StatTile` primitives
2. Homepage variant B rebuilt on them; variant A deleted
3. Blog: frontmatter image field, generated hero images, `PostCard`, serif prose
4. Pricing / about / contact repainted onto the same primitives; correctness fixes applied

Each step is independently shippable.

## Verification

- `npx tsc --noEmit` in `packages/frontend` clean (plain tsc, not `nest build`)
- `npm run lint` clean
- Visual check against `next start -p 3100` from a production build, not dev — per the frontend prod-preview procedure
- Screenshot every touched surface at 1440px and 390px widths, light and dark
- Confirm zero hex literals remain in `app/components/marketing/` and the rebuilt homepage: `grep -rE "\[#[0-9A-Fa-f]{6}\]"` returns nothing
- Confirm one container width and one gutter across marketing by grepping for `max-w-` and `px-` in the touched files
- Lighthouse LCP on `/` no worse than current, since the hero gains an image

## Open questions

1. **Testimonials.** Confirmed as available but not present anywhere in the codebase. Needed: attribution name, role, quote, and permission to use a real name. Determines whether the social-proof slot is a quote row, a single pull quote, or is dropped.
2. **Dark mode.** Marketing currently has zero `dark:` coverage and 604 hex literals that would not flip. Decide whether this pass ships dark-mode-correct marketing or explicitly defers it.
