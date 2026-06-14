"use client";

import {
  TIER_STYLES,
  categoryLabel,
  type FeatureDefinition,
} from "./tier-types";

interface PlannedFeaturesSectionProps {
  plannedByTier: Record<string, FeatureDefinition[]>;
}

export function PlannedFeaturesSection({
  plannedByTier,
}: PlannedFeaturesSectionProps) {
  const hasPlanned = Object.values(plannedByTier).some((f) => f.length > 0);
  if (!hasPlanned) return null;

  return (
    <div className="mt-8">
      <div className="border-t-2 border-dashed border-outline-variant pt-6">
        <h2 className="text-lg font-semibold text-on-surface-variant mb-1">
          Planned Features
          <span className="text-xs font-normal ml-2 text-on-surface-variant/60">
            (not yet enforced — pre-assign to tiers for when they&apos;re built)
          </span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {["free", "pro", "enterprise"].map((tierSlug) => {
            const tierFeats = plannedByTier[tierSlug] || [];
            const style = TIER_STYLES[tierSlug] || TIER_STYLES.free;
            const byCategory: Record<string, FeatureDefinition[]> = {};
            tierFeats.forEach((f) => {
              if (!byCategory[f.category]) byCategory[f.category] = [];
              byCategory[f.category].push(f);
            });

            return (
              <div
                key={tierSlug}
                className={`rounded-xl border ${style.border} ${style.bg} p-3 opacity-70`}
              >
                <div className={`text-xs font-semibold ${style.text} mb-2`}>
                  {tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1)}
                  <span className="ml-2 font-normal">({tierFeats.length})</span>
                </div>
                {Object.entries(byCategory)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([cat, catFeatures]) => (
                    <div key={cat} className="mb-2">
                      <div className="text-[10px] uppercase tracking-wider text-on-surface-variant/50 mb-1">
                        {categoryLabel(cat)}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {catFeatures.map((f) => (
                          <span
                            key={f.id}
                            className={`px-2 py-0.5 text-[11px] rounded border ${style.chip} opacity-60`}
                            title={`${f.slug}\n${f.description || "No description"}`}
                          >
                            {f.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                {tierFeats.length === 0 && (
                  <div className="text-xs text-on-surface-variant/40 italic">
                    None
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
