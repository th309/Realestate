'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Check,
  X,
  Plus,
  Save,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// Types
interface Feature {
  id: string;
  slug: string;
  name: string;
  category: string;
  valueType: 'boolean' | 'integer' | 'string';
}

interface TierFeature {
  featureId: string;
  value: boolean | number | string;
}

interface Tier {
  id: string;
  slug: string;
  name: string;
  displayOrder: number;
  features: TierFeature[];
}

// Mock data - in production, fetch from API
const MOCK_FEATURES: Feature[] = [
  { id: '1', slug: 'metric_home_value', name: 'Home Value Metric', category: 'metrics', valueType: 'boolean' },
  { id: '2', slug: 'metric_population', name: 'Population Metric', category: 'metrics', valueType: 'boolean' },
  { id: '3', slug: 'metric_piq_score', name: 'PropertyIQ Score', category: 'metrics', valueType: 'boolean' },
  { id: '4', slug: 'metric_rental_yield', name: 'Rental Yield Metric', category: 'metrics', valueType: 'boolean' },
  { id: '5', slug: 'metric_cap_rate', name: 'Cap Rate Metric', category: 'metrics', valueType: 'boolean' },
  { id: '6', slug: 'geo_national', name: 'National Level Access', category: 'geography', valueType: 'boolean' },
  { id: '7', slug: 'geo_state', name: 'State Level Access', category: 'geography', valueType: 'boolean' },
  { id: '8', slug: 'geo_metro', name: 'Metro Level Access', category: 'geography', valueType: 'boolean' },
  { id: '9', slug: 'geo_county', name: 'County Level Access', category: 'geography', valueType: 'boolean' },
  { id: '10', slug: 'geo_zip', name: 'ZIP Code Level Access', category: 'geography', valueType: 'boolean' },
  { id: '11', slug: 'preview_metrics_limit', name: 'Preview Metrics Limit', category: 'preview', valueType: 'integer' },
  { id: '12', slug: 'preview_markets_limit', name: 'Preview Markets Limit', category: 'preview', valueType: 'integer' },
];

const MOCK_TIERS: Tier[] = [
  {
    id: 'free',
    slug: 'free',
    name: 'Free',
    displayOrder: 1,
    features: [
      { featureId: '1', value: true },
      { featureId: '2', value: true },
      { featureId: '3', value: true },
      { featureId: '6', value: true },
      { featureId: '7', value: true },
      { featureId: '8', value: true },
      { featureId: '11', value: 3 },
      { featureId: '12', value: 5 },
    ],
  },
  {
    id: 'pro',
    slug: 'pro',
    name: 'Pro',
    displayOrder: 2,
    features: [
      { featureId: '1', value: true },
      { featureId: '2', value: true },
      { featureId: '3', value: true },
      { featureId: '4', value: true },
      { featureId: '5', value: true },
      { featureId: '6', value: true },
      { featureId: '7', value: true },
      { featureId: '8', value: true },
      { featureId: '9', value: true },
      { featureId: '10', value: true },
      { featureId: '11', value: -1 },
      { featureId: '12', value: -1 },
    ],
  },
  {
    id: 'enterprise',
    slug: 'enterprise',
    name: 'Enterprise',
    displayOrder: 3,
    features: MOCK_FEATURES.map((f) => ({
      featureId: f.id,
      value: f.valueType === 'boolean' ? true : -1,
    })),
  },
];

// Sortable tier item component
function SortableTierCard({
  tier,
  features,
  expanded,
  onToggleExpand,
  onFeatureToggle,
  onFeatureValueChange,
}: {
  tier: Tier;
  features: Feature[];
  expanded: boolean;
  onToggleExpand: () => void;
  onFeatureToggle: (featureId: string, enabled: boolean) => void;
  onFeatureValueChange: (featureId: string, value: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tier.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getFeatureValue = (featureId: string) => {
    const tf = tier.features.find((f) => f.featureId === featureId);
    return tf?.value;
  };

  const isFeatureEnabled = (featureId: string) => {
    const value = getFeatureValue(featureId);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return false;
  };

  const categories = [...new Set(features.map((f) => f.category))];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-surface-container rounded-xl border border-outline-variant"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-outline-variant">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-on-surface-variant hover:text-on-surface"
        >
          <GripVertical className="w-5 h-5" />
        </button>

        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 flex-1"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-on-surface-variant" />
          ) : (
            <ChevronRight className="w-4 h-4 text-on-surface-variant" />
          )}
          <span className="font-medium text-on-surface">{tier.name}</span>
          <span className="text-xs text-on-surface-variant">
            ({tier.features.filter((f) => {
              const val = f.value;
              return val === true || (typeof val === 'number' && val !== 0);
            }).length} features)
          </span>
        </button>

        <span className="text-xs bg-surface-container-high px-2 py-1 rounded text-on-surface-variant">
          {tier.slug}
        </span>
      </div>

      {/* Features Grid */}
      {expanded && (
        <div className="p-4 space-y-6">
          {categories.map((category) => (
            <div key={category}>
              <h4 className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-3">
                {category}
              </h4>
              <div className="space-y-2">
                {features
                  .filter((f) => f.category === category)
                  .map((feature) => {
                    const enabled = isFeatureEnabled(feature.id);
                    const value = getFeatureValue(feature.id);

                    return (
                      <div
                        key={feature.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-high"
                      >
                        <span className="text-sm text-on-surface">
                          {feature.name}
                        </span>
                        <div className="flex items-center gap-2">
                          {feature.valueType === 'integer' && enabled && (
                            <input
                              type="number"
                              value={typeof value === 'number' ? value : 0}
                              onChange={(e) =>
                                onFeatureValueChange(
                                  feature.id,
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="w-16 px-2 py-1 text-sm bg-surface-container border border-outline-variant rounded text-center"
                              placeholder="-1 = unlimited"
                            />
                          )}
                          <button
                            onClick={() => onFeatureToggle(feature.id, !enabled)}
                            className={`
                              w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                              ${enabled
                                ? 'bg-green-100 text-green-700'
                                : 'bg-surface-container-high text-on-surface-variant'
                              }
                            `}
                          >
                            {enabled ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Overlay for dragging
function TierDragOverlay({ tier }: { tier: Tier | null }) {
  if (!tier) return null;

  return (
    <div className="bg-surface-container rounded-xl border-2 border-primary shadow-xl p-4">
      <div className="flex items-center gap-3">
        <GripVertical className="w-5 h-5 text-on-surface-variant" />
        <span className="font-medium text-on-surface">{tier.name}</span>
      </div>
    </div>
  );
}

export default function TiersConfigurationPage() {
  const [tiers, setTiers] = useState<Tier[]>(MOCK_TIERS);
  const [features] = useState<Feature[]>(MOCK_FEATURES);
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(
    new Set(['free'])
  );
  const [activeTier, setActiveTier] = useState<Tier | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const tier = tiers.find((t) => t.id === event.active.id);
    setActiveTier(tier || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTier(null);

    if (over && active.id !== over.id) {
      setTiers((items) => {
        const oldIndex = items.findIndex((t) => t.id === active.id);
        const newIndex = items.findIndex((t) => t.id === over.id);

        const newItems = [...items];
        const [removed] = newItems.splice(oldIndex, 1);
        newItems.splice(newIndex, 0, removed);

        // Update display order
        return newItems.map((item, index) => ({
          ...item,
          displayOrder: index + 1,
        }));
      });
      setHasChanges(true);
    }
  };

  const toggleExpand = (tierId: string) => {
    setExpandedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tierId)) {
        next.delete(tierId);
      } else {
        next.add(tierId);
      }
      return next;
    });
  };

  const handleFeatureToggle = (tierId: string, featureId: string, enabled: boolean) => {
    setTiers((prev) =>
      prev.map((tier) => {
        if (tier.id !== tierId) return tier;

        const feature = features.find((f) => f.id === featureId);
        const existingIndex = tier.features.findIndex(
          (f) => f.featureId === featureId
        );

        let newFeatures = [...tier.features];

        if (enabled) {
          const defaultValue = feature?.valueType === 'boolean' ? true : -1;
          if (existingIndex >= 0) {
            newFeatures[existingIndex] = { featureId, value: defaultValue };
          } else {
            newFeatures.push({ featureId, value: defaultValue });
          }
        } else {
          if (existingIndex >= 0) {
            newFeatures[existingIndex] = {
              featureId,
              value: feature?.valueType === 'boolean' ? false : 0,
            };
          }
        }

        return { ...tier, features: newFeatures };
      })
    );
    setHasChanges(true);
  };

  const handleFeatureValueChange = (tierId: string, featureId: string, value: number) => {
    setTiers((prev) =>
      prev.map((tier) => {
        if (tier.id !== tierId) return tier;

        return {
          ...tier,
          features: tier.features.map((f) =>
            f.featureId === featureId ? { ...f, value } : f
          ),
        };
      })
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    // In production, save to API
    console.log('Saving tiers:', tiers);
    setHasChanges(false);
    // Show success toast
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">Tier Configuration</h1>
          <p className="text-on-surface-variant">
            Drag to reorder tiers. Expand to configure features.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="
              flex items-center gap-2 px-4 py-2
              bg-surface-container text-on-surface
              rounded-lg border border-outline-variant
              hover:bg-surface-container-high transition-colors
            "
          >
            <Plus className="w-4 h-4" />
            Add Tier
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
              ${hasChanges
                ? 'bg-primary text-on-primary hover:bg-primary/90'
                : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
              }
            `}
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Tier order determines upgrade paths. Users on the Free tier
          will be shown Pro as their next upgrade option. Use <code className="bg-blue-100 px-1 rounded">-1</code> for
          unlimited integer values.
        </p>
      </div>

      {/* Tiers List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={tiers.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {tiers.map((tier) => (
              <SortableTierCard
                key={tier.id}
                tier={tier}
                features={features}
                expanded={expandedTiers.has(tier.id)}
                onToggleExpand={() => toggleExpand(tier.id)}
                onFeatureToggle={(featureId, enabled) =>
                  handleFeatureToggle(tier.id, featureId, enabled)
                }
                onFeatureValueChange={(featureId, value) =>
                  handleFeatureValueChange(tier.id, featureId, value)
                }
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          <TierDragOverlay tier={activeTier} />
        </DragOverlay>
      </DndContext>
    </div>
  );
}
