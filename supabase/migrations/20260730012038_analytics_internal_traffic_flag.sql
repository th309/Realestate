-- Separate internal traffic from customer traffic.
--
-- Admin and owner browsing is neither bot nor customer, and at 154 sessions
-- against 758 classified-human ones it was roughly 20% of the "people" bucket —
-- enough to move every rate on the dashboard. `EXCLUDED_EMAILS` already existed
-- in AnalyticsProvider.tsx to suppress this, wired correctly to
-- setTrackingExcluded, and had been shipped as an EMPTY SET. Nothing was ever
-- excluded.
--
-- Flagged server-side rather than dropped client-side, for three reasons: it is
-- retroactive (client-side exclusion cannot fix data already collected), it
-- survives a client that fails to apply it, and it keeps the data — internal
-- sessions are the most reliable way to verify the pipeline end to end. Made a
-- SEGMENT, not a deletion.
--
-- Deliberately a separate column from is_bot rather than a fourth state on it.
-- is_bot answers "was this automated"; is_internal answers "was this us". A
-- crawler run from an admin browser is both, and overloading one column would
-- force a false choice — exactly the conflation that made `false` mean two
-- different things and started all of this.

alter table public.user_sessions
  add column if not exists is_internal boolean not null default false;
alter table public.user_events
  add column if not exists is_internal boolean not null default false;

comment on column public.user_sessions.is_internal is
  'True for admin/owner traffic. Excluded from every analytics segment except "internal" and "all". Independent of is_bot: a session can be both.';
comment on column public.user_events.is_internal is
  'True for admin/owner traffic, mirrored from the emitting session.';

-- Analytics reads always pair this with is_bot and a date range.
create index if not exists idx_user_sessions_external_started_at
  on public.user_sessions (started_at desc)
  where is_internal = false;
create index if not exists idx_user_events_external_created
  on public.user_events (event_category, created_at desc)
  where is_internal = false;

-- ── Who counts as internal ──────────────────────────────────────────────────
-- Everyone in admin_users, plus the owner's personal address and any plus-tag
-- alias of it. Gmail treats user+anything@gmail.com as the same mailbox, so the
-- tagged addresses used for test accounts (troyhouston76+pt3@… etc.) are the
-- same person and must not read as separate customers.

create or replace function public.analytics_internal_user_ids()
returns table (user_id uuid)
language sql
stable
as $$
  select a.id from public.admin_users a
  union
  select u.id from auth.users u
  where lower(u.email) = 'troy@propertyiq.app'
     or lower(u.email) ~ '^troyhouston76(\+[^@]*)?@gmail\.com$'
     or lower(u.email) ~ '^troy(\+[^@]*)?@propertyiq\.app$';
$$;

grant execute on function public.analytics_internal_user_ids() to service_role;

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Matched by visitor_id, not just user_id. A visitor is one browser profile, so
-- once it has ever signed in as an internal user, its ANONYMOUS sessions —
-- signed-out browsing, pre-login pageviews — belong to the same person. Keying
-- only on user_id would leave those counted as customers.

with internal_visitors as (
  select distinct s.visitor_id
  from public.user_sessions s
  where s.user_id in (select user_id from public.analytics_internal_user_ids())
    and s.visitor_id is not null
)
update public.user_sessions s
set is_internal = true
from internal_visitors iv
where iv.visitor_id = s.visitor_id
  and s.is_internal = false;

update public.user_events e
set is_internal = s.is_internal
from public.user_sessions s
where s.session_id = e.session_id
  and e.is_internal is distinct from s.is_internal;

-- Lockdown. The applied statement granted service_role but never revoked the
-- PUBLIC default, so anon/authenticated could reach it via /rest/v1/rpc.
revoke all on function public.analytics_internal_user_ids() from public, anon, authenticated;
grant execute on function public.analytics_internal_user_ids() to service_role;
