"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Building2, Loader2, ShieldCheck, BarChart3, User } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MCP_SERVER_URL =
  process.env.NEXT_PUBLIC_MCP_SERVER_URL || "https://mcp.propertyiq.app";

/* ────────────────────────────────────────────── */
/*  Inner component (needs useSearchParams)       */
/* ────────────────────────────────────────────── */

function McpAuthorizeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [user, setUser] = useState<{
    email?: string;
    name?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const mcpSession = searchParams.get("mcp_session");

  /* ── Auth check ── */
  useEffect(() => {
    if (!mcpSession) {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          const returnUrl = `/auth/mcp-authorize?mcp_session=${encodeURIComponent(mcpSession)}`;
          router.push(
            `/auth/sign-in?redirect=${encodeURIComponent(returnUrl)}`,
          );
          return;
        }

        setUser({
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email,
        });
      } catch (err) {
        console.error("[MCP Authorize] Auth check failed:", err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [mcpSession, router]);

  /* ── Allow handler ── */
  const handleAllow = async () => {
    setActionLoading(true);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setActionLoading(false);
      return;
    }

    const callbackUrl = new URL("/oauth/callback", MCP_SERVER_URL);
    callbackUrl.searchParams.set("mcp_session", mcpSession!);
    callbackUrl.searchParams.set("token", session.access_token);
    window.location.href = callbackUrl.toString();
  };

  /* ── Deny handler ── */
  const handleDeny = () => {
    const callbackUrl = new URL("/oauth/callback", MCP_SERVER_URL);
    callbackUrl.searchParams.set("mcp_session", mcpSession!);
    callbackUrl.searchParams.set("error", "access_denied");
    window.location.href = callbackUrl.toString();
  };

  /* ── Missing session parameter ── */
  if (!mcpSession) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-surface-container rounded-2xl border border-outline-variant p-8 shadow-sm text-center">
          <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6 text-error" />
          </div>
          <h1 className="text-lg font-semibold text-on-surface mb-2">
            Invalid Authorization Request
          </h1>
          <p className="text-sm text-on-surface-variant">
            This page requires a valid session parameter. Please start the
            authorization flow from your AI client.
          </p>
        </div>
      </div>
    );
  }

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-surface-container rounded-2xl border border-outline-variant p-8 shadow-sm flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-on-surface-variant">
            Verifying your session...
          </p>
        </div>
      </div>
    );
  }

  /* ── Consent screen ── */
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface-container rounded-2xl border border-outline-variant p-8 shadow-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-on-surface">
            Authorize Claude
          </h1>
        </div>

        {/* Description */}
        <p className="text-sm text-on-surface-variant text-center mb-6">
          Claude wants to access your PropertyIQ account. This will allow Claude
          to use PropertyIQ market analytics tools on your behalf.
        </p>

        {/* User info */}
        <div className="flex items-center gap-3 bg-surface-container-low rounded-xl px-4 py-3 mb-6 border border-outline-variant/50">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            {user?.name && user.name !== user.email && (
              <p className="text-sm font-medium text-on-surface truncate">
                {user.name}
              </p>
            )}
            <p className="text-xs text-on-surface-variant truncate">
              {user?.email}
            </p>
          </div>
        </div>

        {/* Permissions */}
        <div className="mb-8">
          <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-3">
            Permissions requested
          </p>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm text-on-surface">
                Access market analytics tools
              </span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm text-on-surface">
                View your subscription status
              </span>
            </li>
          </ul>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDeny}
            disabled={actionLoading}
            className="flex-1 px-4 py-2.5 border border-outline text-on-surface rounded-full text-sm font-medium hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={handleAllow}
            disabled={actionLoading}
            className="flex-1 px-4 py-2.5 bg-primary text-on-primary rounded-full text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Allow
          </button>
        </div>

        {/* Footer note */}
        <p className="text-xs text-on-surface-variant text-center mt-6">
          By allowing, you authorize Claude to access PropertyIQ tools using
          your account credentials. You can revoke access at any time.
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  Page wrapper (Suspense for useSearchParams)   */
/* ────────────────────────────────────────────── */

export default function McpAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center">
          <div className="w-full max-w-md bg-surface-container rounded-2xl border border-outline-variant p-8 animate-pulse">
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 bg-surface-container-highest rounded-xl mb-4" />
              <div className="h-6 w-48 bg-surface-container-highest rounded" />
            </div>
            <div className="space-y-4">
              <div className="h-4 bg-surface-container-highest rounded w-3/4 mx-auto" />
              <div className="h-16 bg-surface-container-highest rounded-xl" />
              <div className="h-24 bg-surface-container-highest rounded-xl" />
              <div className="flex gap-3">
                <div className="flex-1 h-10 bg-surface-container-highest rounded-full" />
                <div className="flex-1 h-10 bg-surface-container-highest rounded-full" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <McpAuthorizeContent />
    </Suspense>
  );
}
