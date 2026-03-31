"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import {
  CreditCard,
  Plus,
  X as XIcon,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  TIER_STYLES,
  categoryLabel,
  type FeatureDefinition,
} from "./tier-types";
import { FeatureChip } from "./FeatureChip";

interface TierColumnProps {
  tierSlug: string;
  tierName: string;
  features: FeatureDefinition[];
  isOver: boolean;
  pricingBullets: string[];
  onPricingBulletsChange: (items: string[]) => void;
}

export function TierColumn({
  tierSlug,
  tierName,
  features,
  isOver,
  pricingBullets,
  onPricingBulletsChange,
}: TierColumnProps) {
  const { setNodeRef } = useDroppable({ id: tierSlug });
  const style = TIER_STYLES[tierSlug] || TIER_STYLES.free;

  const byCategory = useMemo(() => {
    const map: Record<string, FeatureDefinition[]> = {};
    features.forEach((f) => {
      if (!map[f.category]) map[f.category] = [];
      map[f.category].push(f);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [features]);

  const updateBullet = (index: number, value: string) => {
    const next = [...pricingBullets];
    next[index] = value;
    onPricingBulletsChange(next);
  };
  const removeBullet = (index: number) => {
    onPricingBulletsChange(pricingBullets.filter((_, i) => i !== index));
  };
  const addBullet = () => onPricingBulletsChange([...pricingBullets, ""]);
  const moveBullet = (index: number, dir: -1 | 1) => {
    const next = [...pricingBullets];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onPricingBulletsChange(next);
  };

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-xl border-2 overflow-hidden flex flex-col
        ${isOver ? "border-primary ring-2 ring-primary/20" : style.border}
        ${style.bg}
      `}
    >
      {/* Header */}
      <div className={`px-4 py-3 ${style.header} border-b ${style.border}`}>
        <div className="flex items-center justify-between">
          <span className={`font-semibold ${style.text}`}>{tierName}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${style.chip}`}>
            {features.length}
          </span>
        </div>
        {tierSlug === "free" && (
          <p className="text-xs text-gray-500 mt-1">Available to all users</p>
        )}
        {tierSlug === "pro" && (
          <p className="text-xs text-blue-600 mt-1">Pro + Enterprise</p>
        )}
        {tierSlug === "enterprise" && (
          <p className="text-xs text-indigo-600 mt-1">Enterprise only</p>
        )}
      </div>

      {/* Pricing Card Bullets — at the top of each tier */}
      <div className={`px-3 pt-3 pb-2 border-b ${style.border}`}>
        <div className="flex items-center gap-1.5 mb-2">
          <CreditCard className="w-3 h-3 text-on-surface-variant/60" />
          <h4 className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">
            Show on Pricing Card
          </h4>
        </div>
        <div className="space-y-1.5">
          {pricingBullets.map((item, i) => (
            <div key={i} className="flex items-center gap-1 group">
              <div className="flex flex-col">
                <button
                  onClick={() => moveBullet(i, -1)}
                  disabled={i === 0}
                  className="p-0 text-on-surface-variant/30 hover:text-on-surface-variant disabled:opacity-20"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => moveBullet(i, 1)}
                  disabled={i === pricingBullets.length - 1}
                  className="p-0 text-on-surface-variant/30 hover:text-on-surface-variant disabled:opacity-20"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <input
                type="text"
                value={item}
                onChange={(e) => updateBullet(i, e.target.value)}
                placeholder="Bullet text..."
                className="flex-1 px-2 py-1 bg-white/80 border border-outline-variant/50 rounded text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <button
                onClick={() => removeBullet(i)}
                className="p-0.5 text-on-surface-variant/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={addBullet}
            className={`w-full flex items-center justify-center gap-1 px-2 py-1 rounded border border-dashed ${style.border} text-[10px] ${style.text} hover:bg-white/50 transition-colors`}
          >
            <Plus className="w-3 h-3" />
            Add bullet
          </button>
        </div>
      </div>

      {/* Drop hint */}
      {isOver && (
        <div className="px-4 py-2 bg-primary/10 text-primary text-xs text-center font-medium">
          Drop to assign to {tierName}
        </div>
      )}

      {/* Features */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 max-h-[500px]">
        <SortableContext
          items={features.map((f) => f.id)}
          strategy={rectSortingStrategy}
        >
          {byCategory.map(([category, catFeatures]) => (
            <div key={category}>
              <h4 className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                {categoryLabel(category)}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {catFeatures.map((feature) => (
                  <FeatureChip
                    key={feature.id}
                    feature={feature}
                    tierSlug={tierSlug}
                  />
                ))}
              </div>
            </div>
          ))}
        </SortableContext>

        {features.length === 0 && (
          <div className="text-center py-6 text-on-surface-variant text-xs">
            Drag features here
          </div>
        )}
      </div>
    </div>
  );
}
