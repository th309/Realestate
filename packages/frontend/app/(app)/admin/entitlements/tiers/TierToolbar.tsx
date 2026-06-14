"use client";

import { Save, Search, Filter, Loader2, RefreshCw } from "lucide-react";

interface TierToolbarProps {
  loading: boolean;
  saving: boolean;
  hasChanges: boolean;
  error: string | null;
  searchQuery: string;
  categoryFilter: string;
  allCategories: string[];
  activeCount: number;
  plannedCount: number;
  onRefresh: () => void;
  onSave: () => void;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
}

export function TierToolbar({
  loading,
  saving,
  hasChanges,
  error,
  searchQuery,
  categoryFilter,
  allCategories,
  activeCount,
  plannedCount,
  onRefresh,
  onSave,
  onSearchChange,
  onCategoryChange,
}: TierToolbarProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">
            Feature Access by Tier
          </h1>
          <p className="text-sm text-on-surface-variant">
            Drag features between columns to change access
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-2 bg-surface-container rounded-lg border border-outline-variant text-sm hover:bg-surface-container-high"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onSave}
            disabled={!hasChanges || saving}
            className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
              hasChanges
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
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
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search features..."
            className="w-full pl-9 pr-4 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="pl-9 pr-6 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
          >
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === "all"
                  ? "All"
                  : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-xs text-on-surface-variant mb-4">
        {activeCount} active features
        {plannedCount > 0 && ` · ${plannedCount} planned`}
      </div>
    </>
  );
}
