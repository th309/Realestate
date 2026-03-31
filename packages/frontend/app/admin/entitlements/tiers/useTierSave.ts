"use client";

/**
 * Save logic for tier feature assignments and pricing card bullets.
 * Extracted from page.tsx to keep the page under the line limit.
 */

import { useState, useCallback } from "react";
import { fetchAPIRaw } from "@/lib/data";
import type { FeatureDefinition, FeatureAssignments } from "./tier-types";

const TIER_ORDER = ["free", "pro", "enterprise"];

interface UseTierSaveArgs {
  features: FeatureDefinition[];
  assignments: FeatureAssignments;
  originalAssignments: FeatureAssignments;
  pricingBullets: Record<string, string[]>;
  originalPricingBullets: Record<string, string[]>;
  hasBulletChanges: boolean;
  onFeatureSaved: () => void;
  onBulletsSaved: () => void;
}

export function useTierSave({
  features,
  assignments,
  originalAssignments,
  pricingBullets,
  originalPricingBullets,
  hasBulletChanges,
  onFeatureSaved,
  onBulletsSaved,
}: UseTierSaveArgs) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      // Save feature assignment changes
      const tierUpdates: Record<string, Record<string, boolean>> = {
        free: {},
        pro: {},
        enterprise: {},
      };
      for (const feature of features) {
        const newTier = assignments[feature.id];
        const oldTier = originalAssignments[feature.id];
        if (newTier === oldTier) continue;
        const newTierIndex = TIER_ORDER.indexOf(newTier);
        for (let i = 0; i < TIER_ORDER.length; i++) {
          tierUpdates[TIER_ORDER[i]][feature.slug] = i >= newTierIndex;
        }
      }
      for (const [tierSlug, featureUpdates] of Object.entries(tierUpdates)) {
        if (Object.keys(featureUpdates).length === 0) continue;
        const response = await fetchAPIRaw(
          `/api/admin/features/tier/${tierSlug}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ features: featureUpdates }),
          },
        );
        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Unauthorized — please sign in again."
              : `Failed to save ${tierSlug} (${response.status})`,
          );
        }
        const result = await response.json();
        if (!result.success)
          throw new Error(result.error || `Failed to save ${tierSlug}`);
      }
      onFeatureSaved();

      // Save pricing card bullet changes
      if (hasBulletChanges) {
        for (const slug of TIER_ORDER) {
          const a = pricingBullets[slug] ?? [];
          const b = originalPricingBullets[slug] ?? [];
          if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
            const clean = a.filter((s) => s.trim().length > 0);
            const res = await fetchAPIRaw(
              `/api/admin/features/pricing-card-items/${slug}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: clean }),
              },
            );
            if (!res.ok)
              throw new Error(`Failed to save ${slug} pricing bullets`);
          }
        }
        onBulletsSaved();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [
    features,
    assignments,
    originalAssignments,
    pricingBullets,
    originalPricingBullets,
    hasBulletChanges,
    onFeatureSaved,
    onBulletsSaved,
  ]);

  return { saving, saveError: error, setSaveError: setError, handleSave };
}
