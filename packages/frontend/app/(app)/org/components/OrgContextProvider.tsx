"use client";

import React, { useCallback, useEffect, useState } from "react";
import { fetchOrg, type OrgData } from "@/lib/data";
import { OrgContext, type OrgContextValue } from "../hooks/useOrg";

interface OrgContextProviderProps {
  slug: string;
  children: React.ReactNode;
}

/**
 * Fetches org data by slug and provides it via OrgContext.
 *
 * The backend GET /api/org/:slug returns the org record plus the
 * authenticated user's role (via the membership join), so a single
 * fetch populates both `org` and `role`.
 */
export function OrgContextProvider({
  slug,
  children,
}: OrgContextProviderProps) {
  const [org, setOrg] = useState<OrgData | null>(null);
  const [role, setRole] = useState<"admin" | "member" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrg(slug);
      setOrg(data);
      // The backend enriches the response with the caller's role.
      // If the field isn't present yet (API not deployed), default to null.
      const rawRole = (data as unknown as Record<string, unknown>).role as
        | string
        | undefined;
      setRole(rawRole === "admin" || rawRole === "member" ? rawRole : null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load organization",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value: OrgContextValue = {
    org: org
      ? {
          id: org.id,
          name: org.name,
          slug: org.slug,
          owner_id: org.owner_id,
          seat_limit: org.seat_limit,
          website_url: org.website_url,
          billing_status: org.billing_status,
          embed_enabled: org.embed_enabled,
          created_at: org.created_at,
          updated_at: org.updated_at,
        }
      : null,
    role,
    loading,
    error,
    refresh,
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-outline-variant border-t-primary" />
          <p className="text-sm text-on-surface-variant">
            Loading organization...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="rounded-xl bg-surface-container-low p-6 shadow-sm max-w-md text-center">
          <p className="text-on-surface font-medium">
            Unable to load organization
          </p>
          <p className="text-sm text-on-surface-variant mt-1">{error}</p>
          <button
            onClick={() => void refresh()}
            className="mt-4 rounded-full bg-primary px-6 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}
