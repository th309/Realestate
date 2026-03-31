"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { AlertCircle, RefreshCw } from "lucide-react";
import { fetchAPIRaw } from "@/lib/data";
import { SkeletonLoader } from "@/app/admin/analytics/components/shared/SkeletonLoader";
import TierPricingEditor from "./TierPricingEditor";
import { TierToolbar } from "./TierToolbar";
import { TierColumn } from "./TierColumn";
import { DragOverlayChip } from "./FeatureChip";
import { PlannedFeaturesSection } from "./PlannedFeaturesSection";
import { useTierSave } from "./useTierSave";
import type {
  FeatureDefinition,
  TierData,
  FeatureMatrix,
  FeatureAssignments,
} from "./tier-types";

export default function TiersConfigurationPage() {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureDefinition[]>([]);
  const [tiers, setTiers] = useState<TierData[]>([]);
  const [assignments, setAssignments] = useState<FeatureAssignments>({});
  const [originalAssignments, setOriginalAssignments] =
    useState<FeatureAssignments>({});
  const [activeFeature, setActiveFeature] = useState<FeatureDefinition | null>(
    null,
  );
  const [overTierId, setOverTierId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Pricing card bullets state (per-tier)
  const [pricingBullets, setPricingBullets] = useState<
    Record<string, string[]>
  >({});
  const [originalPricingBullets, setOriginalPricingBullets] = useState<
    Record<string, string[]>
  >({});

  const calculateAssignments = useCallback(
    (matrix: FeatureMatrix): FeatureAssignments => {
      const result: FeatureAssignments = {};
      const tierOrder = ["free", "pro", "enterprise"];
      for (const feature of matrix.features) {
        let assignedTier = "enterprise";
        for (const tierSlug of tierOrder) {
          const tier = matrix.tiers.find((t) => t.slug === tierSlug);
          if (!tier) continue;
          const value = tier.values[feature.slug];
          if (value === true || (typeof value === "number" && value !== 0)) {
            assignedTier = tierSlug;
            break;
          }
        }
        result[feature.id] = assignedTier;
      }
      return result;
    },
    [],
  );

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const response = await fetchAPIRaw("/api/admin/features/matrix");
      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Unauthorized — your session may have expired. Please sign in again."
            : response.status === 403
              ? "Forbidden — you do not have admin access."
              : `Server error (${response.status})`,
        );
      }
      const result = await response.json();
      if (!result.success)
        throw new Error(result.error || "Failed to fetch feature matrix");

      const matrix: FeatureMatrix = result.data;
      setFeatures(matrix.features);
      setTiers(matrix.tiers);
      const calculated = calculateAssignments(matrix);
      setAssignments(calculated);
      setOriginalAssignments(calculated);

      // Fetch pricing card bullets
      try {
        const pricingRes = await fetchAPIRaw("/api/pricing/tiers");
        if (pricingRes.ok) {
          const pricingResult = await pricingRes.json();
          const pricingTiers = pricingResult.data?.tiers ?? [];
          const bullets: Record<string, string[]> = {};
          for (const t of pricingTiers) {
            bullets[t.slug] = [...(t.pricing_card_items ?? [])];
          }
          setPricingBullets(bullets);
          setOriginalPricingBullets(
            Object.fromEntries(
              Object.entries(bullets).map(([k, v]) => [k, [...v]]),
            ),
          );
        }
      } catch {
        // Non-critical
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [calculateAssignments]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const allCategories = useMemo(() => {
    const cats = new Set(features.map((f) => f.category));
    return ["all", ...Array.from(cats).sort()];
  }, [features]);

  const filteredFeatures = useMemo(() => {
    return features.filter((f) => {
      const matchesSearch =
        searchQuery === "" ||
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || f.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [features, searchQuery, categoryFilter]);

  const activeFeatures = useMemo(
    () => filteredFeatures.filter((f) => f.is_enforced !== false),
    [filteredFeatures],
  );
  const plannedFeatures = useMemo(
    () => filteredFeatures.filter((f) => f.is_enforced === false),
    [filteredFeatures],
  );

  const featuresByTier = useMemo(() => {
    const result: Record<string, FeatureDefinition[]> = {
      free: [],
      pro: [],
      enterprise: [],
    };
    for (const feature of activeFeatures) {
      const tier = assignments[feature.id] || "enterprise";
      if (result[tier]) result[tier].push(feature);
    }
    return result;
  }, [activeFeatures, assignments]);

  const plannedByTier = useMemo(() => {
    const result: Record<string, FeatureDefinition[]> = {
      free: [],
      pro: [],
      enterprise: [],
    };
    for (const feature of plannedFeatures) {
      const tier = assignments[feature.id] || "enterprise";
      if (result[tier]) result[tier].push(feature);
    }
    return result;
  }, [plannedFeatures, assignments]);

  // Drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as
      | { feature: FeatureDefinition }
      | undefined;
    if (data) setActiveFeature(data.feature);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      const overId = String(over.id);
      if (["free", "pro", "enterprise"].includes(overId)) {
        setOverTierId(overId);
      } else {
        setOverTierId(assignments[overId] || null);
      }
    } else {
      setOverTierId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event;
    if (!over || !activeFeature) {
      setActiveFeature(null);
      setOverTierId(null);
      return;
    }
    const overId = String(over.id);
    let targetTier: string | null = null;
    if (["free", "pro", "enterprise"].includes(overId)) {
      targetTier = overId;
    } else {
      targetTier = assignments[overId] || null;
    }
    const currentTier = assignments[activeFeature.id];
    if (targetTier && targetTier !== currentTier) {
      setAssignments((prev) => ({ ...prev, [activeFeature.id]: targetTier! }));
    }
    setActiveFeature(null);
    setOverTierId(null);
  };

  // Change detection
  const hasBulletChanges = useMemo(() => {
    return ["free", "pro", "enterprise"].some((s) => {
      const a = pricingBullets[s] ?? [];
      const b = originalPricingBullets[s] ?? [];
      return a.length !== b.length || a.some((v, i) => v !== b[i]);
    });
  }, [pricingBullets, originalPricingBullets]);

  const hasFeatureChanges = useMemo(() => {
    return Object.keys(assignments).some(
      (id) => assignments[id] !== originalAssignments[id],
    );
  }, [assignments, originalAssignments]);

  const hasChanges = hasFeatureChanges || hasBulletChanges;

  const { saving, saveError, setSaveError, handleSave } = useTierSave({
    features,
    assignments,
    originalAssignments,
    pricingBullets,
    originalPricingBullets,
    hasBulletChanges,
    onFeatureSaved: () => setOriginalAssignments({ ...assignments }),
    onBulletsSaved: () =>
      setOriginalPricingBullets(
        Object.fromEntries(
          Object.entries(pricingBullets).map(([k, v]) => [k, [...v]]),
        ),
      ),
  });

  const error = fetchError || saveError;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <SkeletonLoader variant="card" count={3} />
      </div>
    );
  }

  if (error && features.length === 0) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchMatrix}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <TierPricingEditor />

      <TierToolbar
        loading={loading}
        saving={saving}
        hasChanges={hasChanges}
        error={error}
        searchQuery={searchQuery}
        categoryFilter={categoryFilter}
        allCategories={allCategories}
        activeCount={activeFeatures.length}
        plannedCount={plannedFeatures.length}
        onRefresh={fetchMatrix}
        onSave={handleSave}
        onSearchChange={setSearchQuery}
        onCategoryChange={setCategoryFilter}
      />

      {/* Tier columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {["free", "pro", "enterprise"].map((tierSlug) => {
            const tier = tiers.find((t) => t.slug === tierSlug);
            return (
              <TierColumn
                key={tierSlug}
                tierSlug={tierSlug}
                tierName={
                  tier?.name ||
                  tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1)
                }
                features={featuresByTier[tierSlug] || []}
                isOver={overTierId === tierSlug}
                pricingBullets={pricingBullets[tierSlug] ?? []}
                onPricingBulletsChange={(items) =>
                  setPricingBullets((prev) => ({ ...prev, [tierSlug]: items }))
                }
              />
            );
          })}
        </div>

        <DragOverlay>
          <DragOverlayChip feature={activeFeature} />
        </DragOverlay>
      </DndContext>

      <PlannedFeaturesSection plannedByTier={plannedByTier} />

      {features.length === 0 && (
        <div className="text-center py-12 text-on-surface-variant">
          No features found. Run database seed.
        </div>
      )}
    </div>
  );
}
