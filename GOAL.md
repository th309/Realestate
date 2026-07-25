# GOAL.md — SocialAuto: Munch-Style Content-Pipeline Transformation

## Mission

Transform the existing PropertyIQ content-pipeline admin (`packages/frontend/app/(app)/admin/content-pipeline/`) into a seamless, Munch-Studio-style workflow: the system proactively generates on-brand content into a review feed, Troy approves/edits/skips, approved content lands on a calendar and auto-publishes to connected platforms, and a real analytics view shows results. Evolve what exists (pg-boss orchestrator, publishers, review queue, auto-ideation, Remotion renderer) — do not build a parallel clone.

Do not stop at a partial phase and call it done. Never mock success silently — if a platform/API call fails, fix it or flag it visibly.

Full plan: `C:\Users\troyh\.claude\plans\i-want-you-to-drifting-hollerith.md` (session-local); constraints summary below.

## Hard constraints

- Budget: well under $100/mo total recurring (~$35–45 target). Late/Zernio aggregator (~$19), ElevenLabs Starter ($5), HeyGen pay-as-you-go clips, DeepSeek. NO Ayrshare, NO Creatify Pro.
- DeepSeek is the default LLM for all generation, via purpose-based `aiProvider.complete(purpose)` routing.
- Troy never films himself repeatedly: presenter lanes = ElevenLabs voice clone + HeyGen avatar (one-time setups) + faceless Remotion.
- Munch = flow inspiration only; visuals stay PropertyIQ M3 indigo (CLAUDE.md §8). Invoke `frontend-design` skill before UI work.
- New tables carry `brand_id` from day one (productize later).
- Branch: `develop`. Commit with explicit pathspec. Never push without asking.

## Definition of done

- [ ] Phase 0: Stale coverage copy fixed in explainer-videos doc; GOAL.md exists (this file)
- [ ] Phase 1: Task-first Munch-style home replaces run-centric dashboard; plain-language status chips everywhere; every existing capability still reachable
- [ ] Phase 2: `brands`/`posts` model + brand-kit module live; rolling DeepSeek-generated draft feed with inline approve/edit/skip; generated copy provably uses approved coverage stats
- [ ] Phase 3: One real social account connected through the Late/Zernio hosted popup, token stored, status visible on a redesigned platforms wall
- [ ] Phase 4: Approved posts appear on a timezone-aware calendar with drag-drop rescheduling
- [ ] Phase 5: An approved post auto-publishes at its scheduled slot with zero manual steps; failures surface as "Needs attention," never silently dropped
- [ ] Phase 6: Insights shows real per-post reach/engagement from platform APIs (no placeholders), 30d vs prior-30d
- [ ] Phase 7: Avatar/voice presenter lanes work end-to-end (one real HeyGen clip composited with captions + brand bumper); Captions/Resize/Clips repurpose flows live; video upload → auto-clipped shorts enter the same review feed
- [ ] Phase 8: Saving liked styles steers future generation; week/month batch generation in one pass

## Working method (every session)

1. Read this file. Identify the first unchecked item.
2. State which item you're working on and what "done" means for it specifically.
3. Build end-to-end — don't stub integrations and move on.
4. Verify against real APIs / real rendered artifacts, not mocked responses (repo rule: "done" = real artifact at destination).
5. When genuinely working, check the box here and commit (develop, explicit pathspec).
6. Blocked on something only Troy can do? Stop and state exactly what's needed. Do not guess.
7. Move to the next unchecked item.

## Human-in-the-loop blockers (Troy only)

- Late/Zernio account + API key (Phase 3)
- ElevenLabs account + one-time ~2min voice sample (Phase 7)
- HeyGen account + one-time avatar footage/consent recording; budget sign-off for pay-per-use clips (Phase 7)
- Munch Studio: fix stale Business Description by hand; cancel once Phases 2–6 replace it
- Any new paid API usage beyond the budget table
