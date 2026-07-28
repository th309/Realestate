-- Flag automated traffic on user_sessions.
--
-- ~95% of recorded sessions are crawlers: the www.google.com referrer alone
-- accounted for 26,944 sessions across 26,936 distinct visitors, averaging
-- 0.4s and exactly 1.00 pages each. With no way to separate them, every
-- dashboard KPI (visitors, bounce rate, conversion rate, traffic sources) was
-- dominated by bot volume and unusable for decisions.
--
-- Store-and-flag rather than drop-at-ingestion: crawler volume is real SEO
-- signal for the programmatic /markets/* and /blog/* surface, and a flag stays
-- reversible if the heuristic misclassifies. Dropping would not.
--
-- Forward-only by design. Existing rows carry no User-Agent, so they default to
-- false rather than being retroactively guessed from behaviour alone.

alter table public.user_sessions
  add column if not exists is_bot boolean not null default false;

comment on column public.user_sessions.is_bot is
  'True when the session was classified as automated at ingestion. Analytics read paths must exclude these. Rows written before 2026-07-28 are all false (unclassified), not verified-human.';

-- Analytics queries filter on is_bot alongside a started_at range, so index the
-- pair. Partial on the false case: real traffic is the minority of rows and the
-- only side the dashboards read.
create index if not exists idx_user_sessions_human_started_at
  on public.user_sessions (started_at desc)
  where is_bot = false;
