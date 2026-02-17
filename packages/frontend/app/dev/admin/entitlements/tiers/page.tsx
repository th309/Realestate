'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Save,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { fetchAPIRaw } from '@/lib/data';

// Tier styling
const TIER_STYLES: Record<string, { bg: string; border: string; text: string; chip: string; header: string }> = {
  free: {
    bg: 'bg-gray-50',
    border: 'border-gray-300',
    text: 'text-gray-700',
    chip: 'bg-gray-100 text-gray-700 border-gray-300',
    header: 'bg-gray-100',
  },
  pro: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-700',
    chip: 'bg-blue-100 text-blue-700 border-blue-300',
    header: 'bg-blue-100',
  },
  enterprise: {
    bg: 'bg-purple-50',
    border: 'border-purple-300',
    text: 'text-purple-700',
    chip: 'bg-purple-100 text-purple-700 border-purple-300',
    header: 'bg-purple-100',
  },
};

// Types
interface FeatureDefinition {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  value_type: string;
  is_active: boolean;
  is_enforced: boolean;
}

interface TierData {
  id: string;
  slug: string;
  name: string;
  values: Record<string, unknown>;
}

interface FeatureMatrix {
  features: FeatureDefinition[];
  tiers: TierData[];
}

type FeatureAssignments = Record<string, string>; // feature_id -> tier_slug

// Small draggable feature chip
function FeatureChip({
  feature,
  tierSlug,
}: {
  feature: FeatureDefinition;
  tierSlug: string;
}) {
  const style = TIER_STYLES[tierSlug] || TIER_STYLES.free;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: feature.id,
    data: { feature, tierSlug },
  });

  const chipStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={chipStyle}
      {...attributes}
      {...listeners}
      className={`
        px-2 py-1 text-xs rounded border cursor-grab active:cursor-grabbing
        ${style.chip}
        ${isDragging ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-sm'}
        transition-shadow
      `}
      title={`${feature.slug}${feature.description ? '\n' + feature.description : ''}`}
    >
      {feature.name}
    </div>
  );
}

// Droppable tier column
function TierColumn({
  tierSlug,
  tierName,
  features,
  isOver,
}: {
  tierSlug: string;
  tierName: string;
  features: FeatureDefinition[];
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: tierSlug });
  const style = TIER_STYLES[tierSlug] || TIER_STYLES.free;

  // Group by category
  const byCategory = useMemo(() => {
    const map: Record<string, FeatureDefinition[]> = {};
    features.forEach(f => {
      if (!map[f.category]) map[f.category] = [];
      map[f.category].push(f);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [features]);

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-xl border-2 overflow-hidden flex flex-col
        ${isOver ? 'border-primary ring-2 ring-primary/20' : style.border}
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
        {tierSlug === 'free' && (
          <p className="text-xs text-gray-500 mt-1">Available to all users</p>
        )}
        {tierSlug === 'pro' && (
          <p className="text-xs text-blue-600 mt-1">Pro + Enterprise</p>
        )}
        {tierSlug === 'enterprise' && (
          <p className="text-xs text-purple-600 mt-1">Enterprise only</p>
        )}
      </div>

      {/* Drop hint */}
      {isOver && (
        <div className="px-4 py-2 bg-primary/10 text-primary text-xs text-center font-medium">
          Drop to assign to {tierName}
        </div>
      )}

      {/* Features */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 max-h-[500px]">
        <SortableContext items={features.map(f => f.id)} strategy={rectSortingStrategy}>
          {byCategory.map(([category, catFeatures]) => (
            <div key={category}>
              <h4 className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                {category}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {catFeatures.map(feature => (
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

// Drag overlay
function DragOverlayChip({ feature }: { feature: FeatureDefinition | null }) {
  if (!feature) return null;
  return (
    <div className="px-3 py-1.5 text-xs rounded bg-primary text-white shadow-xl font-medium">
      {feature.name}
    </div>
  );
}

export default function TiersConfigurationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [features, setFeatures] = useState<FeatureDefinition[]>([]);
  const [tiers, setTiers] = useState<TierData[]>([]);
  const [assignments, setAssignments] = useState<FeatureAssignments>({});
  const [originalAssignments, setOriginalAssignments] = useState<FeatureAssignments>({});
  const [activeFeature, setActiveFeature] = useState<FeatureDefinition | null>(null);
  const [overTierId, setOverTierId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Calculate assignments from matrix
  const calculateAssignments = useCallback((matrix: FeatureMatrix): FeatureAssignments => {
    const result: FeatureAssignments = {};
    const tierOrder = ['free', 'pro', 'enterprise'];

    for (const feature of matrix.features) {
      let assignedTier = 'enterprise';

      for (const tierSlug of tierOrder) {
        const tier = matrix.tiers.find(t => t.slug === tierSlug);
        if (!tier) continue;

        const value = tier.values[feature.slug];
        const isEnabled = value === true || (typeof value === 'number' && value !== 0);

        if (isEnabled) {
          assignedTier = tierSlug;
          break;
        }
      }

      result[feature.id] = assignedTier;
    }

    return result;
  }, []);

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchAPIRaw('/api/admin/features/matrix');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch feature matrix');
      }

      const matrix: FeatureMatrix = result.data;
      setFeatures(matrix.features);
      setTiers(matrix.tiers);

      const calculated = calculateAssignments(matrix);
      setAssignments(calculated);
      setOriginalAssignments(calculated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [calculateAssignments]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const featureMap = useMemo(() => new Map(features.map(f => [f.id, f])), [features]);

  const allCategories = useMemo(() => {
    const cats = new Set(features.map(f => f.category));
    return ['all', ...Array.from(cats).sort()];
  }, [features]);

  const filteredFeatures = useMemo(() => {
    return features.filter(f => {
      const matchesSearch = searchQuery === '' ||
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || f.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [features, searchQuery, categoryFilter]);

  const activeFeatures = useMemo(() =>
    filteredFeatures.filter(f => f.is_enforced !== false),
    [filteredFeatures]
  );

  const plannedFeatures = useMemo(() =>
    filteredFeatures.filter(f => f.is_enforced === false),
    [filteredFeatures]
  );

  const featuresByTier = useMemo(() => {
    const result: Record<string, FeatureDefinition[]> = { free: [], pro: [], enterprise: [] };
    for (const feature of activeFeatures) {
      const tier = assignments[feature.id] || 'enterprise';
      if (result[tier]) result[tier].push(feature);
    }
    return result;
  }, [activeFeatures, assignments]);

  const plannedByTier = useMemo(() => {
    const result: Record<string, FeatureDefinition[]> = { free: [], pro: [], enterprise: [] };
    for (const feature of plannedFeatures) {
      const tier = assignments[feature.id] || 'enterprise';
      if (result[tier]) result[tier].push(feature);
    }
    return result;
  }, [plannedFeatures, assignments]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { feature: FeatureDefinition } | undefined;
    if (data) setActiveFeature(data.feature);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      const overId = String(over.id);
      if (['free', 'pro', 'enterprise'].includes(overId)) {
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

    if (['free', 'pro', 'enterprise'].includes(overId)) {
      targetTier = overId;
    } else {
      targetTier = assignments[overId] || null;
    }

    const currentTier = assignments[activeFeature.id];

    if (targetTier && targetTier !== currentTier) {
      setAssignments(prev => ({ ...prev, [activeFeature.id]: targetTier! }));
    }

    setActiveFeature(null);
    setOverTierId(null);
  };

  const hasChanges = useMemo(() => {
    return Object.keys(assignments).some(id => assignments[id] !== originalAssignments[id]);
  }, [assignments, originalAssignments]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const tierUpdates: Record<string, Record<string, boolean>> = { free: {}, pro: {}, enterprise: {} };
      const tierOrder = ['free', 'pro', 'enterprise'];

      for (const feature of features) {
        const newTier = assignments[feature.id];
        const oldTier = originalAssignments[feature.id];
        if (newTier === oldTier) continue;

        const newTierIndex = tierOrder.indexOf(newTier);
        for (let i = 0; i < tierOrder.length; i++) {
          tierUpdates[tierOrder[i]][feature.slug] = i >= newTierIndex;
        }
      }

      for (const [tierSlug, featureUpdates] of Object.entries(tierUpdates)) {
        if (Object.keys(featureUpdates).length === 0) continue;

        const response = await fetchAPIRaw(`/api/admin/features/tier/${tierSlug}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ features: featureUpdates }),
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error || `Failed to save ${tierSlug}`);
      }

      setOriginalAssignments({ ...assignments });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-on-surface-variant" />
        <span className="ml-3 text-on-surface-variant">Loading...</span>
      </div>
    );
  }

  if (error && features.length === 0) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button onClick={fetchMatrix} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">
            <RefreshCw className="w-4 h-4 inline mr-2" />Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">Feature Access by Tier</h1>
          <p className="text-sm text-on-surface-variant">Drag features between columns to change access</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchMatrix}
            disabled={loading}
            className="px-3 py-2 bg-surface-container rounded-lg border border-outline-variant text-sm hover:bg-surface-container-high"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
              hasChanges ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {hasChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm text-yellow-700">
          Unsaved changes - click Save to persist
        </div>
      )}

      {/* Search/Filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search features..."
            className="w-full pl-9 pr-4 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-9 pr-6 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
          >
            {allCategories.map(cat => (
              <option key={cat} value={cat}>{cat === 'all' ? 'All' : cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-xs text-on-surface-variant mb-4">
        {activeFeatures.length} active features
        {plannedFeatures.length > 0 && ` · ${plannedFeatures.length} planned`}
      </div>

      {/* Three column layout */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['free', 'pro', 'enterprise'].map(tierSlug => {
            const tier = tiers.find(t => t.slug === tierSlug);
            return (
              <TierColumn
                key={tierSlug}
                tierSlug={tierSlug}
                tierName={tier?.name || tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1)}
                features={featuresByTier[tierSlug] || []}
                isOver={overTierId === tierSlug}
              />
            );
          })}
        </div>

        <DragOverlay>
          <DragOverlayChip feature={activeFeature} />
        </DragOverlay>
      </DndContext>

      {/* Planned Features Section */}
      {plannedFeatures.length > 0 && (
        <div className="mt-8">
          <div className="border-t-2 border-dashed border-outline-variant pt-6">
            <h2 className="text-lg font-semibold text-on-surface-variant mb-1">
              Planned Features
              <span className="text-xs font-normal ml-2 text-on-surface-variant/60">
                (not yet enforced — pre-assign to tiers for when they&apos;re built)
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {['free', 'pro', 'enterprise'].map(tierSlug => {
                const tierFeats = plannedByTier[tierSlug] || [];
                const style = TIER_STYLES[tierSlug] || TIER_STYLES.free;
                const byCategory: Record<string, FeatureDefinition[]> = {};
                tierFeats.forEach(f => {
                  if (!byCategory[f.category]) byCategory[f.category] = [];
                  byCategory[f.category].push(f);
                });

                return (
                  <div key={tierSlug} className={`rounded-xl border ${style.border} ${style.bg} p-3 opacity-70`}>
                    <div className={`text-xs font-semibold ${style.text} mb-2`}>
                      {tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1)}
                      <span className="ml-2 font-normal">({tierFeats.length})</span>
                    </div>
                    {Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catFeatures]) => (
                      <div key={cat} className="mb-2">
                        <div className="text-[10px] uppercase tracking-wider text-on-surface-variant/50 mb-1">{cat}</div>
                        <div className="flex flex-wrap gap-1">
                          {catFeatures.map(f => (
                            <span
                              key={f.id}
                              className={`px-2 py-0.5 text-[11px] rounded border ${style.chip} opacity-60`}
                              title={`${f.slug}\n${f.description || 'No description'}`}
                            >
                              {f.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {tierFeats.length === 0 && (
                      <div className="text-xs text-on-surface-variant/40 italic">None</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {features.length === 0 && (
        <div className="text-center py-12 text-on-surface-variant">
          No features found. Run database seed.
        </div>
      )}
    </div>
  );
}
