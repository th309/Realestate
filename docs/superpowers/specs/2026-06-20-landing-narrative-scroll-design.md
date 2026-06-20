# Landing Page Rewrite — Guided-Narrative Sales Funnel

**Date:** 2026-06-20
**Status:** Design — approved in brainstorm, pending spec review
**Surface:** Homepage `app/(app)/page.tsx` — **full rewrite** of the page structure + new
sections in `app/components/home/`
**Related:** [Cinematic geo zoom](./2026-06-20-map-cinematic-geo-zoom-design.md) is the
"see it on the map" beat (§ Beat 5).

---

## 1. Summary

Rewrite the homepage as a single guided-narrative sales funnel. The page tells one argument
top to bottom — _you can't pick a market on gut feel → here's the data → here's the one
number → here's proof it works → here's what you can do with it → start_ — and each section
makes exactly one point and reveals as the user reaches it. The narrative arc **is** the
page structure; we design it fresh rather than re-sequencing the current grab-bag of sections.

The "guided" feeling comes from CSS `position: sticky` and `IntersectionObserver`-driven
reveals — **never** from hijacking the scroll. This borrows Hubtown's narrative _spine_
while rejecting its materials: no WebGL, no GSAP, no scroll-jacking. Motion is M3 tokens only.

Features are sold by **showing real product output** at the moment a visitor cares — not a
feature grid. This is a rewrite of the **experience and structure**, not a teardown of the
data layer: we salvage proven primitives (data fetchers, `AnimatedCounter`, live-score
data, `AnonCaptureModal`) and preserve all existing SEO intact.

## 2. Goals / Non-Goals

**Goals**

- A purpose-built narrative homepage whose structure is the 8-beat funnel below.
- Apply conversion / sales-funnel best practices (§4) end to end.
- Sell features by **showing real output** (curated snapshots + cached live data), not
  icon-and-blurb grids.
- One product "moment" — the cinematic map zoom — used once, as a demo.
- Tasteful, on-brand motion that protects — does not fight — the in-flight SEO/LCP work.
- Full `prefers-reduced-motion` support; accessible controls.

**Non-Goals**

- No GSAP, no scroll-jacking / scroll-snap that traps the user, no WebGL.
- **No fabricated social proof.** We have backtest/accuracy data; we do NOT have
  testimonials, user counts, or press logos yet. Design leaves slots for them but ships
  without inventing any (per the no-mock-data rule).
- **No regression to SEO:** metadata, JSON-LD, canonical, OpenGraph, and the
  server-rendered hero copy carry over unchanged.
- No change to the data layer or how data is fetched (reuse existing fetchers/endpoints).
- No regenerating expensive output per visitor (see §6).
- Homepage only — not a redesign of `/map`, `/pricing` internals, or other routes.

## 3. What We Salvage vs. Rewrite

A rewrite of structure, not of working plumbing.

**Salvage (reuse as implementation detail):**
| Asset | Why keep |
| --- | --- |
| `fetchStickyScores()` + `/api/scores/top` (with `revalidate`) | Live, real top/bottom metros — cached, cheap, current |
| `AnimatedCounter.tsx` | Count-up already built and on-brand |
| Score ring components (`app/components/scoring/`) | Standardized per CLAUDE.md §9 — must not be re-invented |
| `AnonCaptureModal` (email-first capture) | Existing front-door capture; reuse for CTAs (anon == free) |
| Data fetchers / `@/lib/data` hooks | Data layer untouched |
| SEO metadata + `JsonLd` in `page.tsx` | Preserve verbatim |
| **Blue/indigo gradient background** | **Retained** — keep the existing page wrapper gradient (see §4.0) |
| `DemoSection` / preview components | Possible scaffolding for snapshot display (not live demos) |

**Rewrite (build alongside, do NOT delete — see §9 reversibility):**

- The new homepage is a **parallel** composition; the old homepage stays **fully intact as
  the control variant** until the new design is confirmed the winner.
- New section components for each beat (may copy/adapt copy + data from the old sections).
- The current order is **not** the target for the new page; the 8-beat funnel is.
- **Cleanup is deferred.** Normally we delete stale variants (one source of truth), but
  reversibility requires both to coexist during the experiment. The "delete the old
  homepage + dead sections" step happens only **after** the flag is promoted to `on`
  (§9) — it is an explicit follow-up task, not part of the initial build.

## 4.0 Visual Foundation (retained)

The landing page keeps its current **blue/indigo gradient background** — the existing
`page.tsx` wrapper:
`bg-gradient-to-b from-[#1A237E] via-[#3949AB] via-30% to-[#E8EAF6]`
(Primary Dark → Primary at ~30% → fading to Primary Container near the bottom). This is a
hard constraint of the rewrite, not up for redesign.

Implications the beats must respect:

- **Top of page is dark indigo** → hero (beat 1), tension (2), foundation (3) use
  **light-on-dark** treatment (white/`text-on-primary` text, light score ring chrome).
- **Page fades to light** (`#E8EAF6`) toward the lower beats → later sections (proof,
  persona, pricing, close) shift to **dark-on-light** as the gradient lightens.
- Section surfaces (cards, the persona panel, the sticky score ring) must hold **WCAG AA
  contrast at whatever point on the gradient they sit** — verify both ends.
- Per CLAUDE.md §8.2, use semantic color variables where possible; the gradient stops are
  the established exception already in the codebase.

## 4. Conversion & Funnel Best Practices (applied)

These are implemented across the beats, not as a separate section on the page:

1. **One primary conversion goal, repeated.** A single primary CTA — start free
   (reverse-trial: every signup starts on Pro; no credit card) — repeated at natural
   decision points (hero, after Score, after Proof, after persona, close). Secondary links
   de-emphasized so they never compete.
2. **5-second clarity above the fold.** Hero states what it is, who it's for, and what you
   get, with live proof and the CTA — no scrolling required to "get it."
3. **PAS structure.** Problem (beat 2) → Agitate (the cost of guessing) → Solve
   (beats 3–7). Classic funnel spine.
4. **Show, don't tell.** Real product outputs (§6), never icon+blurb feature grids.
5. **Specificity over hype.** Real markets, real numbers — matches brand voice (CLAUDE.md §8.6).
6. **Objection handling, in order:** _"Is it accurate?"_ → Proof beat (backtest +
   confidence + named-author E-E-A-T). _"Is it worth it?"_ → value framing near pricing.
   _"Is it for me?"_ → persona branch.
7. **Risk reversal.** Free tier, reverse-trial, cancel-anytime stated at the CTA.
8. **Friction reduction.** Email-first capture via `AnonCaptureModal`; minimal fields.
9. **Trust signals.** Data sources (Zillow, Realtor, Census, FRED, BLS), methodology link,
   named author — woven into Foundation + Proof beats.
10. **Loss-aversion framing.** "Don't buy blind / don't guess" — the cost of the wrong
    market is the emotional hook.
11. **Performance is conversion.** Fast load = higher conversion; the motion approach (§7)
    is chosen specifically to protect LCP/INP.
12. **Mobile-first.** Most traffic is mobile; every beat designed for narrow viewport first.

## 5. The Narrative — 8 beats (the new page structure)

| #   | Beat (the one point)                                                                                                                        | Motion                                                     | Sticky?         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------- |
| 1   | **Verdict first** — a real market + its live Score; primary CTA                                                                             | none on load (LCP)                                         | no              |
| 2   | **The tension** — too many markets, conflicting Zillow/Realtor numbers, gut-feel decisions                                                  | fade-up on enter                                           | no              |
| 3   | **The foundation** — scale as credibility (~935 metros / 3,150 counties / 34,000 ZIPs; 5 data sources)                                      | count-up (`AnimatedCounter`)                               | no              |
| 4   | **The Score** — one number 1–99; 50 = your state's average; confidence is separate                                                          | **sticky ring**, text beats scroll past                    | **yes**         |
| 5   | **See it** — fly/zoom to a featured market with the spotlight outline                                                                       | scroll-triggered cinematic zoom (other spec), then release | **yes (brief)** |
| 6   | **Proof** — backtest: markets scoring 45–55 realized ≈0 excess return vs. their state; higher scores predicted outperformance; named author | small chart fades in                                       | no              |
| 7   | **What you can do with it** — persona branch showing real feature output (see §5.1)                                                         | 200ms cross-fade on tab switch                             | no              |
| 8   | **The close** — single CTA, reverse-trial framing                                                                                           | quiet fade-up                                              | no              |

**Supporting beats:** a brief data-depth beat and pricing slot between Proof (6) and Close
(8); a _future_ social-proof (testimonials/logos) slot sits near Proof, shipped empty/hidden
until real assets exist. Placement detail in §8.

### 5.1 Beat 7 — Persona branch + feature showcase (4 co-equal personas)

A segmented control with four tabs; switching cross-fades the panel (200ms). Each persona
leads with the feature that persona cares about, shown as **real output** (§6):

| Persona tab                | Marquee feature      | Real-output shown                                               |
| -------------------------- | -------------------- | --------------------------------------------------------------- |
| **Investor**               | Deal Analyzer        | Curated snapshot of a real deal verdict (cashflow + deal grade) |
| **Agent**                  | Reports              | Curated snapshot of a real listing-presentation / market report |
| **First-time buyer**       | Affordability        | Curated snapshot of a real rent-vs-own / affordability view     |
| **Power user / developer** | **Claude MCP + API** | Curated snapshot of a real MCP query → response exchange        |

The MCP/developer tab is co-equal with the others (per decision). Its panel shows an actual
MCP exchange (a real tool call against PropertyIQ data and the returned result), framed as
"PropertyIQ where you already work — Claude, MCP, and the API." Keep the copy plain so a
non-technical visitor who lands on this tab still grasps the value ("ask your AI assistant
about any market and it answers from our data").

> **Default tab:** lead with **Investor** (primary audience, highest expected conversion);
> users switch freely. Power-user/MCP is a tab, not the default — present but not in the
> primary audience's face.

### 5.2 Beat 1 — Hero (verdict first)

A claim + live proof: a real market name with its actual PropertyIQ Score ring (from the
cached live-score fetch), e.g. "Austin scores 41. Here's why that matters before you buy."
Static, instant-painting — **this is the LCP element**, server-rendered with no load
animation. One primary CTA (start free, no card).

### 5.3 Beat 4 — The Score (centerpiece, sticky mechanic)

The Score ring pins to one side (`position: sticky`) while three short copy beats scroll
past: _(a) one number 1–99 → (b) 50 = your state's average → (c) confidence rating,
independent of the score._ The ring's value animates as each beat locks in; the page
scrolls normally throughout, releasing when the section ends.

> Score copy must follow CLAUDE.md §9 exactly: "50 = state average," **computed nationally,
> calibrated to state.** Do **not** write "ranked within state."

## 6. Real-Output Strategy (no per-visit regeneration)

"Real output" = genuine product output, never mocked/fabricated — but nothing is
regenerated per visitor. Two mechanisms, chosen per element:

| Element                                  | Mechanism                                                                       | Cost / visit        |
| ---------------------------------------- | ------------------------------------------------------------------------------- | ------------------- |
| Hero score ring + live top/bottom metros | **Cached live (ISR)** — server fetch with `revalidate` (already built)          | ~0 (cached DB read) |
| Deal Analyzer verdict (investor)         | **Curated snapshot** of a real analysis, captured once, refreshed on a schedule | 0 (static)          |
| Report example (agent)                   | **Curated snapshot** of a real report                                           | 0 (static)          |
| Affordability view (buyer)               | **Curated snapshot** (or cached live if cheap)                                  | 0 (static)          |
| MCP query → response (power user)        | **Curated snapshot** of a real exchange                                         | 0 (static)          |

- **Never** call the analyzer/AI/MCP live on page load — it would burn tokens on anonymous
  visitors and wreck CWV.
- Curated snapshots are vetted, frozen "hero examples" we control (AI output varies
  run-to-run, so we don't want it live). Captured from a real market (e.g. Austin) and
  stored as static content; refresh cadence + ownership is an open decision (§8).
- A snapshot is "real" in the sense the no-mock-data rule requires: a frozen capture of a
  _genuine_ run, not a hand-authored plausible-looking fake.

## 7. Motion System (M3, no GSAP)

- **Reveal:** shared `useReveal` hook backed by `IntersectionObserver`. On enter:
  opacity 0→1, translateY ~20px→0. `duration-400`, M3 standard easing
  `cubic-bezier(0.2, 0, 0, 1)`. Transforms/opacity only — GPU-friendly, no per-frame
  scroll listeners.
- **Stagger:** list/card children animate ~70ms apart.
- **Count-ups:** reuse `AnimatedCounter`, trigger on enter, `duration-600`. Below the fold
  only — never touches LCP.
- **Sticky:** CSS `position: sticky` for beats 4–5. No JS scroll-jacking, no scroll-snap.
  This is the single most important difference from Hubtown.
- **Persona cross-fade (beat 7):** 200ms opacity cross-fade on tab switch.
- **Map moment (beat 5):** governed by the cinematic-geo-zoom spec; triggered once on
  enter, releases after.
- **Optional progress rail:** a slim left-rail dot indicator marking the 8 beats. (§8.)

## 8. Accessibility & Performance

- **`prefers-reduced-motion: reduce`** → all reveals/count-ups/sticky transitions collapse
  to instant final states. Non-negotiable.
- **LCP protection:** hero (beat 1) is server-rendered, static, no load animation — it
  stays the LCP element. All animation is below the fold and observer-driven. This _defends_
  the recent LCP/CWV commits rather than fighting them.
- **No new heavy bundle.** `IntersectionObserver` is native; `AnimatedCounter` exists;
  snapshots are static (no demo runtimes).
- **Keyboard/focus:** persona segmented control is a real control (roving tabindex / radio
  semantics), not a div.

## 9. Reversibility, Rollout & A/B Measurement

The redesign must be reversible without a code revert. We ship the new page **alongside**
the old one and switch via a flag; A/B measurement layers on top of the same flag.

### 9.1 Variants

- **A (control):** the existing homepage, kept fully intact.
- **B (variant):** the new 8-beat narrative homepage.

### 9.2 Master flag (modes, not just on/off)

A single experiment flag drives behavior. Set in Railway env for prod (per CLAUDE.md §4.3
— prod vars via Railway, not local `.env`):

| Mode      | Behavior                                                    | Used for             |
| --------- | ----------------------------------------------------------- | -------------------- |
| `off`     | Everyone sees A (old)                                       | **Instant rollback** |
| `preview` | Everyone sees A; B reachable only via private noindexed URL | "Not sure" review    |
| `ab:<n>`  | Split traffic n% to B, rest to A; both measured             | The experiment       |
| `on`      | Everyone sees B (promote winner)                            | Launch               |

Progressive path: **build → `preview` → `ab:50` → `on` (or back to `off`)**. Every
transition is a flag change — no redeploy, no git revert.

### 9.3 Variant assignment (no flash, sticky per visitor)

- Next.js **middleware** assigns a sticky variant cookie on first visit (deterministic
  split), so the server component renders A or B directly — no client flash, no hydration
  mismatch. Same visitor always sees the same variant for clean measurement.
- **Preview:** a `?landing=v2` query param (or a dedicated preview route) sets an override
  cookie and forces B; the preview is `noindex` so search engines never see the draft and
  no canonical/SEO duplication occurs.
- Bots/crawlers: serve A (control) or honor `noindex` on B previews to avoid SEO ambiguity.

### 9.4 Measurement

- **Event store:** reuse `user_events` (NOT `analytics_events` — real events live in
  `user_events`). Stamp the assigned `variant` onto the homepage pageview and every funnel
  event: CTA click, anon-capture, signup started, signup completed.
- **Primary metric:** signup completion rate per variant (homepage visitors → completes).
- **Secondary metrics:** CTA click-through rate, anon-capture rate — locate _where_ a
  variant wins or leaks.
- **Readout:** one grouped query against `user_events` (illustrative — exact column/JSONB
  path for `variant` + event names must be verified against the live schema at build time):

  ```sql
  select variant,
         count(*) filter (where event_name = 'home_view')        as visitors,
         count(*) filter (where event_name = 'signup_completed') as conversions,
         round(100.0 * count(*) filter (where event_name='signup_completed')
               / nullif(count(*) filter (where event_name='home_view'),0), 2) as conv_rate_pct
  from user_events
  where created_at >= now() - interval '14 days' and variant in ('A','B')
  group by variant;
  ```

  Optional: surface this as a small card on the existing admin analytics page.

### 9.5 Significance caveat (important)

~94% of traffic lands on SEO pages, not `/`, and homepage→signup volume is low, so an A/B
may take a long time to reach statistical significance. **The preview + flag let us ship on
judgment when the page is clearly better; the A/B runs as confirmation, not a gate.** Do not
block a clearly-superior page on a slow-to-significance test. Define a minimum-conversions
threshold before calling a winner, but allow a manual judgment promote.

### 9.6 Reuse check (build-time)

Before building the flag/middleware, confirm whether an experiment/flag or event-tracking
helper already exists (the activation-funnel work added event tracking). Reuse it rather
than inventing a parallel system.

## 10. Open Decisions (for the user)

1. **Snapshot refresh cadence + ownership.** How often are the curated Analyzer/Report/MCP
   snapshots refreshed, and is it manual or a scheduled job? Recommendation: manual to
   start, revisit if they go stale-looking.
2. **Featured market.** Which real market headlines the hero + snapshots (Austin used as
   placeholder). Pick one with a memorable, on-message Score.
3. **Supporting sections.** Confirm data-depth + pricing slot between Proof and Close
   (vs. relocating to their own routes) so the spine stays tight.
4. **Future social-proof slot.** Reserve a hidden testimonials/logos slot near Proof now
   (to fill when assets exist), or add later? Recommendation: reserve the slot.
5. **Progress rail + mobile sticky.** Include the left-rail indicator? And confirm beats
   4–5 stack to a column (visual on top, text below, sticky relaxed) on narrow viewports.

## 11. Acceptance Criteria

- [ ] Old homepage (control A) remains fully intact; new page (B) ships alongside it, not in place.
- [ ] Master flag switches `off`/`preview`/`ab:<n>`/`on` via Railway env with no redeploy or git revert.
- [ ] `off` instantly restores the old homepage; `preview` exposes B only via a private noindexed URL.
- [ ] Variant assignment is server-side (middleware cookie) with no client flash; sticky per visitor.
- [ ] B previews are `noindex`; no canonical/SEO duplication between A and B.
- [ ] `variant` is stamped on homepage pageview + funnel events in `user_events`; the readout query returns per-variant conversion rate.
- [ ] Old homepage + dead sections are deleted only as a follow-up task after the flag is promoted to `on`.
- [ ] Homepage is rebuilt as one continuous 8-beat funnel top to bottom.
- [ ] Conversion best practices (§4) are present: single repeated primary CTA, hero clarity,
      PAS flow, risk reversal, email-first capture, objection-handling order.
- [ ] Features are sold via real output (§6); no icon-and-blurb feature grid.
- [ ] Persona branch has 4 co-equal tabs (investor default); each shows its feature's real
      output; MCP/developer tab shows a real MCP exchange; control is keyboard-accessible.
- [ ] No feature output is generated per visitor; snapshots are static, live data is cached.
- [ ] Beat 4 Score ring pins (sticky) while its three copy beats scroll past, then releases.
- [ ] Beat 5 triggers the cinematic map zoom once on enter, then releases.
- [ ] Proof beat uses only real backtest/accuracy data + named author; no fabricated
      testimonials/counts/logos anywhere.
- [ ] Score copy matches CLAUDE.md §9 ("50 = state average," national computation) in intent.
- [ ] SEO metadata, JSON-LD, canonical, OpenGraph carry over unchanged; verified in built HTML.
- [ ] `prefers-reduced-motion` collapses all motion to instant final states.
- [ ] Hero remains the static, server-rendered LCP element; no first-load CWV regression.
- [ ] No GSAP / WebGL / scroll-jacking introduced.
- [ ] Verified in a real browser at desktop + mobile widths with live data (not mocks).
