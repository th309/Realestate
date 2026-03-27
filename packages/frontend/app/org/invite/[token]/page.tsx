"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  fetchInviteDetails,
  acceptOrgInvite,
  type InviteDetails,
} from "@/lib/data";
import {
  LoadingSkeleton,
  ReadyView,
  AcceptedView,
  ErrorView,
} from "./invite-views";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageState =
  | { kind: "loading" }
  | { kind: "ready"; invite: InviteDetails }
  | { kind: "accepting" }
  | { kind: "accepted"; orgSlug: string; role: string }
  | { kind: "error"; code: ErrorCode; message: string };

export type ErrorCode =
  | "expired"
  | "email_mismatch"
  | "already_accepted"
  | "already_in_org"
  | "not_found"
  | "network"
  | "unknown";

// ---------------------------------------------------------------------------
// Error classifier
// ---------------------------------------------------------------------------

function classifyError(message: string): { code: ErrorCode; friendly: string } {
  const lower = message.toLowerCase();

  if (lower.includes("expired")) {
    return {
      code: "expired",
      friendly:
        "This invite has expired. Please ask the organization admin to send a new one.",
    };
  }
  if (lower.includes("different email") || lower.includes("email_mismatch")) {
    return {
      code: "email_mismatch",
      friendly:
        "You're signed in with a different email than the one this invite was sent to. Please sign out and sign in with the correct email address.",
    };
  }
  if (
    lower.includes("already been used") ||
    lower.includes("already accepted")
  ) {
    return {
      code: "already_accepted",
      friendly: "This invite has already been used.",
    };
  }
  if (lower.includes("already a member") || lower.includes("another org")) {
    return {
      code: "already_in_org",
      friendly:
        "You're already a member of another organization. Contact support to transfer.",
    };
  }
  if (lower.includes("not found") || lower.includes("invalid")) {
    return {
      code: "not_found",
      friendly:
        "This invite link is invalid. Please check the link or ask the admin to resend it.",
    };
  }

  return { code: "unknown", friendly: message };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [state, setState] = useState<PageState>({ kind: "loading" });

  // ---- Fetch invite details on mount ----
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadInvite() {
      try {
        const invite = await fetchInviteDetails(token);
        if (!cancelled) setState({ kind: "ready", invite });
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Unable to load invite details.";
        const { code, friendly } = classifyError(message);
        setState({ kind: "error", code, message: friendly });
      }
    }

    loadInvite();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // ---- Accept handler ----
  const handleAccept = useCallback(async () => {
    if (!token || state.kind !== "ready") return;

    const role = state.invite.role;
    setState({ kind: "accepting" });

    try {
      const { orgSlug } = await acceptOrgInvite(token);
      setState({ kind: "accepted", orgSlug, role });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to accept invite.";
      const { code, friendly } = classifyError(message);
      setState({ kind: "error", code, message: friendly });
    }
  }, [token, state]);

  // ---- Auto-redirect after acceptance ----
  useEffect(() => {
    if (state.kind !== "accepted") return;

    const isAdmin = state.role.toLowerCase() === "admin";
    const destination = isAdmin ? `/org/${state.orgSlug}/admin` : "/";
    const timer = setTimeout(() => router.push(destination), 2000);
    return () => clearTimeout(timer);
  }, [state, router]);

  // ---- Auth redirect (sign-in or sign-up based on whether user exists) ----
  const handleAuth = useCallback(
    (userExists: boolean) => {
      const redirect = `/org/invite/${token}`;
      const authPage = userExists ? "/auth/sign-in" : "/auth/sign-up";
      router.push(`${authPage}?redirect=${encodeURIComponent(redirect)}`);
    },
    [token, router],
  );

  // ---- Render ----
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-surface flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-surface-container rounded-2xl border border-outline-variant p-8 shadow-sm">
          {(state.kind === "loading" || authLoading) && <LoadingSkeleton />}

          {state.kind === "ready" && !authLoading && (
            <ReadyView
              invite={state.invite}
              isAuthenticated={!!user}
              onAccept={handleAccept}
              onAuth={() => handleAuth(state.invite.userExists)}
            />
          )}

          {state.kind === "accepting" && (
            <div className="flex flex-col items-center py-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-on-surface-variant">
                Joining organization...
              </p>
            </div>
          )}

          {state.kind === "accepted" && (
            <AcceptedView orgSlug={state.orgSlug} role={state.role} />
          )}

          {state.kind === "error" && (
            <ErrorView
              code={state.code}
              message={state.message}
              token={token}
            />
          )}
        </div>
      </div>
    </div>
  );
}
