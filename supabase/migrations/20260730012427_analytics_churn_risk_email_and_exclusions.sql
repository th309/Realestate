-- Churn risk: return the email, exclude internal accounts, close the signed-in-bot gap.
--
-- The panel's entire purpose is deciding who to contact, and it returned only a
-- user_id — so it rendered a column of UUIDs that nobody can act on. The
-- ChurnRiskUser type already carried an optional `email` field that nothing ever
-- populated. Admin-only surface behind AdminGuard, executed as service_role, so
-- returning the address is appropriate here and nowhere else.
--
-- Two correctness fixes while the definition is open:
--
--   INTERNAL accounts are excluded. The owner appearing in his own churn-risk
--   list is noise, and admin browsing is not a customer relationship.
--
--   `is_bot is not true` closes a real gap. The previous version scoped only on
--   `user_id is not null`, reasoning that a crawler never signs in — but
--   session-manager writes a UA-derived `is_bot = true` on the SAME insert that
--   sets user_id, so an authenticated session from QA automation, a synthetic
--   monitor, or a replayed scraped session carried both and was counted. NULL is
--   still admitted deliberately: it means "never classified", which is true of
--   nearly all pre-2026-07-28 signed-in history, and excluding it would empty
--   the panel.

drop function if exists public.analytics_churn_risk_users(timestamptz, integer, integer, text, integer);

create function public.analytics_churn_risk_users(
  p_start timestamptz,
  p_inactive_days integer default 14,
  p_min_sessions integer default 3,
  p_tier text default null,
  p_limit integer default 100
)
returns table (
  user_id uuid,
  email text,
  last_seen timestamptz,
  session_count bigint,
  tier text
)
language sql
stable
as $$
  with scoped as (
    select s.user_id, s.user_tier, s.last_activity_at
    from public.user_sessions s
    where s.user_id is not null
      and s.started_at >= p_start
      and s.is_bot is not true
      and not s.is_internal
      and s.user_id not in (select u.user_id from public.analytics_internal_user_ids() u)
  ),
  per_user as (
    select
      scoped.user_id,
      max(scoped.last_activity_at) as last_seen,
      count(*)::bigint as session_count,
      -- The tier they were last seen on. The old JS took whichever row happened
      -- to arrive first, which is not defined at all.
      (array_agg(scoped.user_tier order by scoped.last_activity_at desc))[1]::text as tier
    from scoped
    group by scoped.user_id
  )
  select
    per_user.user_id,
    au.email::text,
    per_user.last_seen,
    per_user.session_count,
    per_user.tier
  from per_user
  -- LEFT JOIN: a deleted auth user must still appear as a churn signal rather
  -- than vanishing from the list because their row is gone.
  left join auth.users au on au.id = per_user.user_id
  where per_user.last_seen < now() - make_interval(days => greatest(coalesce(p_inactive_days, 14), 1))
    and per_user.session_count >= coalesce(p_min_sessions, 3)
    and (p_tier is null or per_user.tier = p_tier)
  -- Most recently gone quiet first: those are the ones still worth a mail.
  order by per_user.last_seen desc
  limit greatest(coalesce(p_limit, 100), 1);
$$;

revoke all on function public.analytics_churn_risk_users(timestamptz, integer, integer, text, integer) from public, anon, authenticated;
grant execute on function public.analytics_churn_risk_users(timestamptz, integer, integer, text, integer) to service_role;
