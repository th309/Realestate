-- Retention purge for user_events: one year, in bounded batches.
--
-- THREE PROBLEMS WITH THE PREVIOUS VERSION, which was a single
-- `.delete().lt('created_at', purgeDate)` from Node:
--
--   1. It kept 90 days. The Visitors tab reconstructs a person's whole journey
--      from user_events, so a cleanup job nobody was thinking about was setting
--      the horizon on a headline feature. A visitor with 39 sessions over five
--      months would have had most of their history silently missing, and the
--      timeline would have looked complete because absence renders as absence.
--
--   2. It was unbatched. A single DELETE over a large backlog runs long, and
--      PostgREST times out at 60 seconds — leaving the transaction rolled back
--      and the same work to redo, forever, with no progress and no error
--      surfaced (the call's result was never checked).
--
--   3. It never checked its own error. A failing purge and a purge with nothing
--      to do were indistinguishable.
--
-- Batched deletes commit incrementally, so a run that is interrupted keeps the
-- progress it made. The caller loops until a batch comes back short.
--
-- Sessions are deliberately NOT purged here. They are ~2.5% of the row count of
-- events, they carry the acquisition attribution the dashboards aggregate over,
-- and dropping a session while keeping nothing of its events would strand the
-- rollup rather than tidy it.

create or replace function public.analytics_purge_old_events(
  p_retain_days int default 365,
  p_batch_limit int default 20000
)
returns bigint
language plpgsql
as $$
declare
  v_deleted bigint;
  v_cutoff timestamptz;
begin
  -- Floor the retention at 90 days so a bad argument cannot wipe recent history.
  -- Deletion is not recoverable, so this fails safe toward keeping too much.
  v_cutoff := now() - make_interval(days => greatest(coalesce(p_retain_days, 365), 90));

  with doomed as (
    select id
    from public.user_events
    where created_at < v_cutoff
    order by created_at
    limit greatest(coalesce(p_batch_limit, 20000), 1)
  ),
  removed as (
    delete from public.user_events e
    using doomed d
    where e.id = d.id
    returning e.id
  )
  select count(*) into v_deleted from removed;

  return v_deleted;
end;
$$;

revoke all on function public.analytics_purge_old_events(int, int) from public, anon, authenticated;
grant execute on function public.analytics_purge_old_events(int, int) to service_role;

-- Index supporting the purge scan and the retention-window reads.
create index if not exists idx_user_events_created_at on public.user_events (created_at);
