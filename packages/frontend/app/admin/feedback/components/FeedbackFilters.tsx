/**
 * Feedback Filters Component
 * 
 * Filter controls for status, category, and tester.
 */

'use client';

import { CATEGORY_CONFIG, STATUS_CONFIG } from '../../../betatest/types';
import type { FeedbackCategory, FeedbackStatus } from '../../../betatest/types';

interface FilterState {
  status: FeedbackStatus | 'all';
  category: FeedbackCategory | 'all';
  testerId: string | 'all';
}

interface FeedbackFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  testers: { id: string; name: string }[];
}

const CATEGORIES: FeedbackCategory[] = ['bug', 'workflow', 'ux_ui', 'feature_request', 'performance', 'other'];
const STATUSES: FeedbackStatus[] = ['submitted', 'triaged', 'in_progress', 'fixed', 'deployed', 'wont_fix', 'duplicate'];

export function FeedbackFilters({ filters, onFilterChange, testers }: FeedbackFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 p-4 bg-surface-container rounded-xl border border-outline-variant">
      {/* Status Filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
          Status
        </label>
        <select
          value={filters.status}
          onChange={(e) => onFilterChange({ ...filters, status: e.target.value as FeedbackStatus | 'all' })}
          className="px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_CONFIG[status].label}
            </option>
          ))}
        </select>
      </div>

      {/* Category Filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
          Category
        </label>
        <select
          value={filters.category}
          onChange={(e) => onFilterChange({ ...filters, category: e.target.value as FeedbackCategory | 'all' })}
          className="px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_CONFIG[cat].icon} {CATEGORY_CONFIG[cat].label}
            </option>
          ))}
        </select>
      </div>

      {/* Tester Filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
          Tester
        </label>
        <select
          value={filters.testerId}
          onChange={(e) => onFilterChange({ ...filters, testerId: e.target.value })}
          className="px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="all">All Testers</option>
          {testers.map((tester) => (
            <option key={tester.id} value={tester.id}>
              {tester.name}
            </option>
          ))}
        </select>
      </div>

      {/* Clear Filters */}
      {(filters.status !== 'all' || filters.category !== 'all' || filters.testerId !== 'all') && (
        <div className="flex items-end">
          <button
            onClick={() => onFilterChange({ status: 'all', category: 'all', testerId: 'all' })}
            className="px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}
