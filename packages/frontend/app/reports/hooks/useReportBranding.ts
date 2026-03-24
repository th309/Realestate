"use client";

import { useState, useEffect } from "react";
import { fetchPublicBranding, type OrgBranding } from "@/lib/data";

/**
 * Fetches org branding for a report based on its organization_id.
 * Returns null when there is no org association or the fetch fails.
 */
export function useReportBranding(organizationId: string | null): {
  branding: OrgBranding | null;
  loading: boolean;
} {
  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [loading, setLoading] = useState(!!organizationId);

  useEffect(() => {
    if (!organizationId) {
      setBranding(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const data = await fetchPublicBranding(organizationId!);
        if (!cancelled) setBranding(data);
      } catch {
        if (!cancelled) setBranding(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return { branding, loading };
}
