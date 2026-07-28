-- Flag automated traffic on user_events as well as user_sessions.
--
-- `is_bot` on user_sessions alone does not reach the event-sourced panels:
-- Top Pages, Navigation Flows, Common Paths, Outbound Destinations and the
-- funnel stage counts all query user_events directly, so they stayed as
-- bot-polluted as before the session flag existed.
--
-- Denormalised rather than joined, mirroring `user_tier`, which is already
-- carried on both tables for the same reason: PostgREST cannot express the
-- join, and resolving a session-id set per query would mean pulling tens of
-- thousands of ids on every dashboard load.
--
-- Set at ingestion from the same User-Agent used for the session flag, so the
-- two tables cannot disagree for a given session.

alter table public.user_events
  add column if not exists is_bot boolean not null default false;

comment on column public.user_events.is_bot is
  'True when the emitting session was classified as automated at ingestion. Analytics read paths must exclude these. Rows written before 2026-07-28 are all false (unclassified), not verified-human.';

-- Event panels filter on is_bot together with a created_at range and usually an
-- event_category. Partial index on the human side, which is the only side read.
create index if not exists idx_user_events_human_category_created
  on public.user_events (event_category, created_at desc)
  where is_bot = false;
