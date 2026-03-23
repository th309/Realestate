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

// Module-level cookie snapshot — set once on first client-side mount,
// then available synchronously for all subsequent component mounts.
let cookieUid: string | null | undefined; // undefined = not checked yet

function readUidCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)piq-uid=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function useAuthState() {
  const [state, setState] = useState<AuthState>(() => {
    // Module-level cache from a previous getSession() call (instant)
    if (cachedSession !== undefined) {
      return {
        user: cachedSession?.user ?? null,
        session: cachedSession,
        loading: false,
      };
    }

    // Module-level cookie snapshot from a previous mount (instant, no hydration mismatch)
    if (cookieUid !== undefined) {
      return {
        user: cookieUid ? ({ id: cookieUid } as User) : null,
        session: null,
        loading: false,
      };
    }

    // First mount — return null to match SSR, then useEffect resolves immediately
    return { user: null, session: null, loading: true };
  });

  useEffect(() => {
    // On first client mount, check the middleware cookie for instant auth.
    // This runs synchronously within the effect before getSession() fires,
    // so the "loading" flash is a single frame at most.
    if (cachedSession === undefined && cookieUid === undefined) {
      const uid = readUidCookie();
      cookieUid = uid;
      if (uid) {
        setState({
          user: { id: uid } as User,
          session: null,
          loading: false,
        });
      } else {
        setState({ user: null, session: null, loading: false });
      }
    }

    const supabase = createSupabaseBrowserClient();

    // Hydrate with full session (gets access token for API calls)
    supabase.auth.getSession().then(({ data: { session } }) => {
      cachedSession = session;
      cookieUid = session?.user?.id ?? null;
      setState({ user: session?.user ?? null, session, loading: false });
    });

    // Listen for auth changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      cachedSession = session;
      cookieUid = session?.user?.id ?? null;
      setState({ user: session?.user ?? null, session, loading: false });
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
