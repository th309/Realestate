-- Only the live site counts.
--
-- Development surfaces were being measured as customer behaviour: sessions
-- referred from localhost, and sessions landing on /dev-* harness pages. The
-- paywall panel exposed this most sharply — /dev-paywalls carried 14 events per
-- variant against 1-3 for the real gates on /screener and /map, so a test
-- fixture was the site's apparent dominant conversion surface.
--
-- Folded into `is_internal` rather than given a fourth flag: from the
-- dashboard's point of view "our own browsing" and "our own test pages" are the
-- same exclusion, and every read path already honours is_internal.
--
-- Most of these were already caught by the visitor-id match (a browser that has
-- ever signed in as an admin), which is why only 2 sessions remain. The point of
-- the rule is that it holds for dev traffic from a browser that never signs in.

update public.user_sessions s
set is_internal = true
where s.is_internal = false
  and (
    s.referrer_domain = 'localhost'
    or s.referrer like 'http://localhost%'
    or s.referrer like 'http://127.0.0.1%'
    or s.landing_page like '/dev-%'
    or s.exit_page like '/dev-%'
  );

update public.user_events e
set is_internal = true
where e.is_internal = false
  and (
    e.page_path like '/dev-%'
    or exists (
      select 1 from public.user_sessions s
      where s.session_id = e.session_id and s.is_internal
    )
  );
