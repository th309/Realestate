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
 * Read the piq-uid cookie set by middleware to determine auth status
 * synchronously — no async getSession() needed on initial render.
 */
function readUidCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)piq-uid=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function useAuthState() {
  const [state, setState] = useState<AuthState>(() => {
    // 1. Module-level cache (fastest — already resolved in this JS session)
    if (cachedSession !== undefined) {
      return {
        user: cachedSession?.user ?? null,
        session: cachedSession,
        loading: false,
      };
    }

    // 2. Cookie from middleware (synchronous — avoids loading flash on first page load)
    const uid = readUidCookie();
    if (uid) {
      // We know the user is logged in but don't have the full User object yet.
      // Create a minimal placeholder — enough for !!user checks and user.id.
      return {
        user: { id: uid } as User,
        session: null,
        loading: false,
      };
    }

    // 3. No cookie — user is not logged in (or very first visit before middleware ran)
    return { user: null, session: null, loading: false };
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Hydrate with full session (gets access token for API calls)
    supabase.auth.getSession().then(({ data: { session } }) => {
      cachedSession = session;
      setState({ user: session?.user ?? null, session, loading: false });
    });

    // Listen for auth changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      cachedSession = session;
      setState({ user: session?.user ?? null, session, loading: false });
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
