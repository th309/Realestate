-- Widen analytics id columns that overflowed at varchar(50).
--
-- Server-emitted analytics events use synthetic ids of the form
-- 'server-session:<uuid>' (15 + 36 = 51 chars) and 'server:<uuid>'. The 51-char
-- session id exceeded varchar(50), so EVERY server-side event/session insert
-- failed with "value too long for type character varying(50)" — silently, since
-- the emitter is fire-and-forget. Standardize these id columns on varchar(100)
-- (matching the existing paywall_events.session_id) so valid ids fit.
--
-- Widening a varchar length is a fast catalog-only change (no table rewrite) and
-- never truncates existing data.

ALTER TABLE public.user_events        ALTER COLUMN session_id      TYPE varchar(100);
ALTER TABLE public.user_events        ALTER COLUMN visitor_id      TYPE varchar(100);
ALTER TABLE public.user_events        ALTER COLUMN client_event_id TYPE varchar(100);
ALTER TABLE public.user_sessions      ALTER COLUMN session_id      TYPE varchar(100);
ALTER TABLE public.user_sessions      ALTER COLUMN visitor_id      TYPE varchar(100);
ALTER TABLE public.visitor_identities ALTER COLUMN visitor_id      TYPE varchar(100);
