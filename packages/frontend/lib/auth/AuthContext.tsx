"use client";

import React, { createContext, useContext, useCallback, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthState } from "./useAuth";
import type { User, Session, AuthError } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: AuthError | null }>;
  signInWithOAuth: (
    provider: "google",
    redirectPath?: string,
  ) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    redirectTo?: string,
  ) => Promise<{
    error: AuthError | null;
    session: Session | null;
    user: User | null;
  }>;
  verifySignupOtp: (
    email: string,
    token: string,
  ) => Promise<{ error: AuthError | null; session: Session | null }>;
  resendSignupOtp: (email: string) => Promise<{ error: AuthError | null }>;
  verifyRecoveryOtp: (
    email: string,
    token: string,
  ) => Promise<{ error: AuthError | null; session: Session | null }>;
  verifyMagicLinkOtp: (
    email: string,
    token: string,
  ) => Promise<{ error: AuthError | null; session: Session | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  updateProfile: (data: {
    display_name?: string;
    avatar_url?: string;
  }) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUserId,
}: {
  children: React.ReactNode;
  initialUserId?: string | null;
}) {
  const { user, session, loading } = useAuthState(initialUserId ?? null);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    },
    [],
  );

  const signInWithMagicLink = useCallback(async (email: string) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error };
  }, []);

  const signInWithOAuth = useCallback(
    async (provider: "google", redirectPath?: string) => {
      const supabase = createSupabaseBrowserClient();
      const callbackUrl =
        redirectPath && redirectPath !== "/map"
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectPath)}`
          : `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl },
      });
      return { error };
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string, redirectTo?: string) => {
      const supabase = createSupabaseBrowserClient();
      const callbackUrl = redirectTo
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
        : `${window.location.origin}/auth/callback`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callbackUrl,
          data: { tos_accepted_at: new Date().toISOString() },
        },
      });
      return {
        error,
        session: data?.session ?? null,
        user: data?.user ?? null,
      };
    },
    [],
  );

  const verifySignupOtp = useCallback(async (email: string, token: string) => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    return { error, session: data?.session ?? null };
  }, []);

  const resendSignupOtp = useCallback(async (email: string) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });
    return { error };
  }, []);

  // Mirrors verifySignupOtp — same call shape, "recovery" type — for the
  // standalone-safe password-reset code path (PWA email links open the
  // phone's browser, not the installed app, so a typed code is the only
  // path that works there). Resending is resetPassword(email) again.
  const verifyRecoveryOtp = useCallback(
    async (email: string, token: string) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "recovery",
      });
      return { error, session: data?.session ?? null };
    },
    [],
  );

  // Verifies the code from a signInWithOtp (magic link) email — the
  // standalone-safe alternative to clicking the link. Same call signup
  // makes (type: "email"); kept as its own named method since it's invoked
  // from the sign-in flow, not signup.
  const verifyMagicLinkOtp = useCallback(
    async (email: string, token: string) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      return { error, session: data?.session ?? null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    return { error };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  }, []);

  const updateProfile = useCallback(
    async (data: { display_name?: string; avatar_url?: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        data: { display_name: data.display_name, avatar_url: data.avatar_url },
      });
      return { error };
    },
    [],
  );

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      signInWithPassword,
      signInWithMagicLink,
      signInWithOAuth,
      signUp,
      verifySignupOtp,
      resendSignupOtp,
      verifyRecoveryOtp,
      verifyMagicLinkOtp,
      signOut,
      resetPassword,
      updatePassword,
      updateProfile,
    }),
    [
      user,
      session,
      loading,
      signInWithPassword,
      signInWithMagicLink,
      signInWithOAuth,
      signUp,
      verifySignupOtp,
      resendSignupOtp,
      verifyRecoveryOtp,
      verifyMagicLinkOtp,
      signOut,
      resetPassword,
      updatePassword,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
