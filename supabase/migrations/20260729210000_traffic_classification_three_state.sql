-- Make `is_bot` three-state so "unclassified" stops masquerading as "human".
--
-- The column shipped as `boolean NOT NULL DEFAULT false`, which overloads
-- `false` to mean BOTH "checked, and human" and "never checked". Classification
-- is forward-only from 2026-07-28, so of 48,243 sessions in the trailing 30 days
-- exactly 70 were flagged — every read path filtering `is_bot = false` therefore
-- passed ~48,000 unclassified crawler sessions through as human, and every
-- dashboard number on /admin/analytics was a measurement of crawler behaviour.
--
-- After this migration:
--   true  = classified automated
--   false = classified human, on evidence
--   NULL  = unclassified / unknown
--
-- NULL is deliberately NOT "probably human". Read paths default to the `human`
-- segment (`is_bot IS FALSE`), which excludes NULL, so unclassified traffic is
-- visible as its own bucket instead of silently inflating the human one.
--
-- Note `.eq('is_bot', false)` in PostgREST still behaves correctly against a
-- nullable column (SQL `= false` is NULL-safe in the sense that NULL rows do not
-- match), but callers must use `.is()` to express the NULL case at all.

alter table public.user_sessions alter column is_bot drop not null;
alter table public.user_events   alter column is_bot drop not null;

comment on column public.user_sessions.is_bot is
  'Three-state traffic classification. true = automated, false = human on evidence, NULL = unclassified. Analytics read paths default to the human segment (is_bot IS FALSE), which excludes NULL by design.';

comment on column public.user_events.is_bot is
  'Three-state traffic classification, mirrored from the emitting session. true = automated, false = human on evidence, NULL = unclassified.';

-- The existing partial indexes cover `is_bot = false`. The dashboard also needs
-- to count and segment the unclassified bucket, so index that side too.
create index if not exists idx_user_sessions_unclassified_started_at
  on public.user_sessions (started_at desc)
  where is_bot is null;

create index if not exists idx_user_events_unclassified_created
  on public.user_events (event_category, created_at desc)
  where is_bot is null;

-- Bot traffic is real SEO/GEO signal (crawler volume on the programmatic
-- /markets/* and /blog/* surface), so it gets its own index rather than being
-- treated as noise to scan past.
create index if not exists idx_user_sessions_bot_started_at
  on public.user_sessions (started_at desc)
  where is_bot is true;
