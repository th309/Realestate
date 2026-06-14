"use client";

import { useRouter } from "next/navigation";
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
import type { InviteDetails } from "@/lib/data";
import type { ErrorCode } from "./page";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

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
// Sub-components
// ---------------------------------------------------------------------------

export function LoadingSkeleton() {
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

export function ReadyView({
  invite,
  isAuthenticated,
  onAccept,
  onAuth,
}: {
  invite: InviteDetails;
  isAuthenticated: boolean;
  onAccept: () => void;
  onAuth: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
        <Building2 className="w-6 h-6 text-primary" />
      </div>

      <p className="text-sm text-on-surface-variant mb-1">
        You&apos;ve been invited to join
      </p>
      <h1 className="text-2xl font-semibold text-on-surface mb-3">
        {invite.orgName}
      </h1>

      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
        <UserPlus className="w-3.5 h-3.5" />
        {formatRole(invite.role)}
      </span>

      <p className="text-sm text-on-surface-variant mb-2">
        You&apos;ll join as a member of this organization.
      </p>
      <p className="text-xs text-on-surface-variant/70 mb-6">
        Invite sent to{" "}
        <span className="font-medium text-on-surface-variant">
          {invite.email}
        </span>
      </p>

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
          onClick={onAuth}
          className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          <LogIn className="w-4 h-4" />
          {invite.userExists ? "Sign in to accept" : "Create account to accept"}
        </button>
      )}

      <p className="mt-4 text-xs text-on-surface-variant flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        {expiresInLabel(invite.expiresAt)}
      </p>
    </div>
  );
}

export function AcceptedView({
  orgSlug,
  role,
}: {
  orgSlug: string;
  role: string;
}) {
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

export function ErrorView({
  code,
  message,
  token,
}: {
  code: ErrorCode;
  message: string;
  token?: string;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center text-center py-4">
      <div className="w-12 h-12 bg-error/10 rounded-xl flex items-center justify-center mb-4">
        <ErrorIcon code={code} />
      </div>
      <h2 className="text-lg font-semibold text-on-surface mb-2">
        Unable to join
      </h2>
      <p className="text-sm text-on-surface-variant mb-6">{message}</p>
      {code === "email_mismatch" && token ? (
        <button
          type="button"
          onClick={() => {
            const redirect = `/org/invite/${token}`;
            router.push(
              `/auth/sign-in?redirect=${encodeURIComponent(redirect)}`,
            );
          }}
          className="w-full px-4 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 mb-3"
        >
          <LogIn className="w-4 h-4" />
          Sign in with a different account
        </button>
      ) : null}
      <a
        href="/"
        className="text-sm text-primary hover:text-primary/80 font-medium"
      >
        Return to homepage
      </a>
    </div>
  );
}
