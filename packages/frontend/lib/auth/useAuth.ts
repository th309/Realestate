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
        cachedSession = session;
        setState({ user: session?.user ?? null, session, loading: false });
      });

    // Listen for auth changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      cachedSession = session;
      setState({ user: session?.user ?? null, session, loading: false });
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
