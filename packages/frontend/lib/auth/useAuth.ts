"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

// Module-level session cache so subsequent mounts resolve instantly.
let cachedSession: Session | null | undefined; // undefined = not yet resolved

// Track per-user ensureProfile calls in this tab so we don't hit the DB on
// every SIGNED_IN / token refresh event.
const ensuredProfileUserIds = new Set<string>();

/**
 * Defensive belt-and-suspenders: if the `handle_new_user` trigger silently
 * failed for this user (see troyhouston76@gmail.com on 2026-04-13), their
 * auth.users row exists but user_profiles does not. On every session
 * establishment, check and backfill the profile row.
 *
 * Fire-and-forget — never blocks auth flow. Never throws.
 */
async function ensureProfile(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  userId: string,
  email: string | null | undefined,
): Promise<void> {
  if (ensuredProfileUserIds.has(userId)) return;
  ensuredProfileUserIds.add(userId);

  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      const nowIso = new Date().toISOString();
      await supabase.from("user_profiles").upsert(
        {
          id: userId,
          email: email ?? null,
          created_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "id" },
      );
    }
  } catch (err) {
    // Defensive: if this fails (RLS, network, whatever), do not break auth.
    console.error("ensureProfile failed", err);
    // Allow a later attempt by removing the guard on failure.
    ensuredProfileUserIds.delete(userId);
  }
}

/**
 * Core auth state hook.
 *
 * @param initialUserId - User ID read from the piq-uid cookie in the Server
 *   Component (layout.tsx). Passed through on SSR so the first render already
 *   knows whether the user is logged in — no hydration mismatch, no loading
 *   flash. The full User/Session objects are hydrated in useEffect.
 */
export function useAuthState(initialUserId: string | null) {
  const [state, setState] = useState<AuthState>(() => {
    // 1. Module-level cache from a previous getSession() (SPA navigations)
    if (cachedSession !== undefined) {
      return {
        user: cachedSession?.user ?? null,
        session: cachedSession,
        loading: false,
      };
    }

    // 2. Server-provided userId (first page load — same value on SSR and client)
    if (initialUserId) {
      return {
        user: { id: initialUserId } as User,
        session: null,
        loading: false,
      };
    }

    // 3. Not logged in
    return { user: null, session: null, loading: false };
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Hydrate with full session (gets access token for API calls)
    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: any } }) => {
        // A transient null from getSession() (cookies not yet readable on a
        // cold load, or mid token-refresh) must NOT downgrade a user the server
        // already confirmed via the piq-uid cookie. Clobbering it here wiped the
        // server-seeded id and poisoned cachedSession=null, pinning authenticated
        // users (incl. admins) to the anonymous "free" tier until an unrelated
        // onAuthStateChange event flipped them back. Keep the seeded id and wait
        // for onAuthStateChange to deliver the real session.
        if (!session && initialUserId) {
          return;
        }
        cachedSession = session;
        setState({ user: session?.user ?? null, session, loading: false });
        if (session?.user) {
          ensureProfile(supabase, session.user.id, session.user.email).catch(
            console.error,
          );
        }
      });

    // Listen for auth changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      cachedSession = session;
      setState({ user: session?.user ?? null, session, loading: false });
      if (session?.user) {
        ensureProfile(supabase, session.user.id, session.user.email).catch(
          console.error,
        );
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
