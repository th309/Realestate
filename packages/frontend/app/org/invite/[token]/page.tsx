"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  Loader2,
  AlertCircle,
  UserPlus,
  Clock,
  CheckCircle2,
  ShieldAlert,
  LogIn,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  fetchInviteDetails,
  acceptOrgInvite,
  type InviteDetails,
} from "@/lib/data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageState =
  | { kind: "loading" }
  | { kind: "ready"; invite: InviteDetails }
  | { kind: "accepting" }
  | { kind: "accepted"; orgSlug: string; role: string }
  | { kind: "error"; code: ErrorCode; message: string };

type ErrorCode =
  | "expired"
  | "already_accepted"
  | "already_in_org"
  | "not_found"
  | "network"
  | "unknown";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map backend error messages to user-friendly copy + error codes. */
function classifyError(message: string): { code: ErrorCode; friendly: string } {
  const lower = message.toLowerCase();

  if (lower.includes("expired")) {
    return {
      code: "expired",
      friendly:
        "This invite has expired. Please ask the organization admin to send a new one.",
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

/** Calculate a human-readable time-remaining string from an expiry ISO date. */
function expiresInLabel(expiresAt: string): string {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const diffMs = expiry - now;

  if (diffMs <= 0) return "This invite has expired";

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 1) return `This invite expires in ${days} days`;
  if (days === 1) return "This invite expires in 1 day";
  if (hours > 1) return `This invite expires in ${hours} hours`;
  if (hours === 1) return "This invite expires in 1 hour";
  return "This invite expires soon";
}

/** Format role string for display. */
function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Error icon per code
// ---------------------------------------------------------------------------

function ErrorIcon({ code }: { code: ErrorCode }) {
  switch (code) {
    case "expired":
      return <Clock className="w-6 h-6 text-error" />;
    case "already_accepted":
      return <CheckCircle2 className="w-6 h-6 text-on-surface-variant" />;
    case "already_in_org":
      return <ShieldAlert className="w-6 h-6 text-error" />;
    default:
      return <AlertCircle className="w-6 h-6 text-error" />;
  }
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

  // ---- Sign-in redirect ----
  const handleSignIn = useCallback(() => {
    const redirect = `/org/invite/${token}`;
    router.push(`/auth/sign-in?redirect=${encodeURIComponent(redirect)}`);
  }, [token, router]);

  // ---- Render ----
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-surface flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-surface-container rounded-2xl border border-outline-variant p-8 shadow-sm">
          {/* Loading state */}
          {(state.kind === "loading" || authLoading) && <LoadingSkeleton />}

          {/* Ready state */}
          {state.kind === "ready" && !authLoading && (
            <ReadyView
              invite={state.invite}
              isAuthenticated={!!user}
              onAccept={handleAccept}
              onSignIn={handleSignIn}
            />
          )}

          {/* Accepting state */}
          {state.kind === "accepting" && (
            <div className="flex flex-col items-center py-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-sm text-on-surface-variant">
                Joining organization...
              </p>
            </div>
          )}

          {/* Accepted state */}
          {state.kind === "accepted" && (
            <AcceptedView orgSlug={state.orgSlug} role={state.role} />
          )}

          {/* Error state */}
          {state.kind === "error" && (
            <ErrorView code={state.code} message={state.message} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="flex flex-col items-center py-4 animate-pulse">
      <div className="w-12 h-12 bg-surface-container-high rounded-xl mb-6" />
      <div className="h-4 w-48 bg-surface-container-high rounded mb-3" />
      <div className="h-6 w-56 bg-surface-container-high rounded mb-3" />
      <div className="h-4 w-32 bg-surface-container-high rounded mb-6" />
      <div className="h-10 w-full bg-surface-container-high rounded-lg" />
    </div>
  );
}

function ReadyView({
  invite,
  isAuthenticated,
  onAccept,
  onSignIn,
}: {
  invite: InviteDetails;
  isAuthenticated: boolean;
  onAccept: () => void;
  onSignIn: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Icon */}
      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
        <Building2 className="w-6 h-6 text-primary" />
      </div>

      {/* Heading */}
      <p className="text-sm text-on-surface-variant mb-1">
        You&apos;ve been invited to join
      </p>
      <h1 className="text-2xl font-semibold text-on-surface mb-3">
        {invite.orgName}
      </h1>

      {/* Role badge */}
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
        <UserPlus className="w-3.5 h-3.5" />
        {formatRole(invite.role)}
      </span>

      {/* Organization info */}
      <p className="text-sm text-on-surface-variant mb-6">
        You&apos;ll join as a member of this organization.
      </p>

      {/* Action button */}
      {isAuthenticated ? (
        <button
          type="button"
          onClick={onAccept}
          className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Accept Invitation
        </button>
      ) : (
        <button
          type="button"
          onClick={onSignIn}
          className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          <LogIn className="w-4 h-4" />
          Sign in to accept
        </button>
      )}

      {/* Expiry notice */}
      <p className="mt-4 text-xs text-on-surface-variant flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        {expiresInLabel(invite.expiresAt)}
      </p>
    </div>
  );
}

function AcceptedView({ orgSlug, role }: { orgSlug: string; role: string }) {
  const isAdmin = role.toLowerCase() === "admin";
  const destination = isAdmin ? "organization dashboard" : "homepage";

  return (
    <div className="flex flex-col items-center text-center py-4">
      <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-4">
        <CheckCircle2 className="w-6 h-6 text-green-600" />
      </div>
      <h2 className="text-lg font-semibold text-on-surface mb-2">
        Welcome aboard!
      </h2>
      <p className="text-sm text-on-surface-variant">
        You&apos;ve joined as{" "}
        <span className="font-medium text-on-surface">{formatRole(role)}</span>.
        Redirecting to the {destination}...
      </p>
    </div>
  );
}

function ErrorView({ code, message }: { code: ErrorCode; message: string }) {
  return (
    <div className="flex flex-col items-center text-center py-4">
      <div className="w-12 h-12 bg-error/10 rounded-xl flex items-center justify-center mb-4">
        <ErrorIcon code={code} />
      </div>
      <h2 className="text-lg font-semibold text-on-surface mb-2">
        Unable to join
      </h2>
      <p className="text-sm text-on-surface-variant mb-6">{message}</p>
      <a
        href="/"
        className="text-sm text-primary hover:text-primary/80 font-medium"
      >
        Return to homepage
      </a>
    </div>
  );
}
