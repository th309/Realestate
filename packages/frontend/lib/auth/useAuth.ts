"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

// Module-level session cache so subsequent mounts resolve instantly
// instead of waiting for the async getSession() call each time.
let cachedSession: Session | null | undefined; // undefined = not yet resolved

export function useAuthState() {
  const [state, setState] = useState<AuthState>(() => {
    // If we already resolved the session, skip the loading state entirely
    if (cachedSession !== undefined) {
      return {
        user: cachedSession?.user ?? null,
        session: cachedSession,
        loading: false,
      };
    }
    return { user: null, session: null, loading: true };
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      cachedSession = session;
      setState({ user: session?.user ?? null, session, loading: false });
    });

    // Listen for auth changes
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
