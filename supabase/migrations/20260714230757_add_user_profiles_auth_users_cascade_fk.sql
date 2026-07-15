-- user_profiles.id had no FK to auth.users, so deleting an auth user
-- (e.g. E2E test cleanup, admin/GDPR deletion) orphaned the profile row
-- instead of removing it. Orphaned rows kept matching the behavioral-trigger
-- cron's eligibility query and got re-emailed every hour, because the
-- dedup insert into email_triggers (FK'd to auth.users) silently failed
-- for them. This closes the gap at the source.
--
-- Applied live via Supabase MCP on 2026-07-14 (version 20260714230757);
-- this file mirrors that change so local/staging DBs and `supabase db pull`
-- stay in sync with the remote schema.
alter table public.user_profiles
  drop constraint if exists user_profiles_id_fkey;

alter table public.user_profiles
  add constraint user_profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
