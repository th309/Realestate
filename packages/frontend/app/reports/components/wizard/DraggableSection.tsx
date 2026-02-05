'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

export interface SectionItem {
  id: string;
  type: string;
  name: string;
  description?: string;
  required?: boolean;
  enabled: boolean;
  collapsed?: boolean;
}

interface DraggableSectionProps {
  section: SectionItem;
  onToggle: (id: string) => void;
  onRemove?: (id: string) => void;
  onExpand?: (id: string) => void;
  isDragging?: boolean;
  isOverlay?: boolean;
}

// Map section types to display names
const SECTION_TYPE_NAMES: Record<string, string> = {
  report_title: 'Report Title',
  report_metadata: 'Report Metadata',
  score_gauge_single: 'Score Gauge',
  score_gauge_dual: 'Dual Score Gauge',
  metric_grid: 'Key Metrics Grid',
  metric_detail: 'Metric Detail',
  metric_highlight: 'Metric Highlight',
  metric_comparison: 'Metric Comparison',
  chart_single: 'Chart',
  chart_grid: 'Chart Grid',
  comparison_chart_grid: 'Comparison Charts',
  comparison_table: 'Comparison Table',
  comparison_radar: 'Radar Comparison',
  comparison_header: 'Comparison Header',
  ai_narrative: 'AI Analysis',
  market_verdict_bar: 'Market Verdict',
  winner_badges: 'Winner Badges',
  pros_cons_table: 'Pros & Cons',
  strengths_risks: 'Strengths & Risks',
  score_breakdown: 'Score Breakdown',
  investment_verdict: 'Investment Verdict',
  fact_box: 'Fact Box',
  ranked_list: 'Ranked List',
  indicator_dashboard: 'Indicators Dashboard',
  indicator_deep_dive: 'Indicator Deep Dive',
  indicator_summary_table: 'Indicator Summary',
  stress_indicator: 'Stress Indicator',
  stress_summary: 'Stress Summary',
  cycle_indicator: 'Cycle Indicator',
  cycle_diagram: 'Cycle Diagram',
  percentile_bands: 'Percentile Bands',
  percentile_rank: 'Percentile Rank',
  scenario_card: 'Scenario Card',
  scenario_chart: 'Scenario Chart',
  forecast_display: 'Forecast Display',
  affordability_gap_visual: 'Affordability Gap',
  savings_calculator: 'Savings Calculator',
  personal_affordability: 'Personal Affordability',
  budget_breakdown: 'Budget Breakdown',
  savings_timeline: 'Savings Timeline',
  alternative_areas: 'Alternative Areas',
  migration_sankey: 'Migration Flow',
  pro_forma_assumptions: 'Pro Forma Assumptions',
  pro_forma_cash_flow: 'Cash Flow Analysis',
  pro_forma_returns: 'Returns Summary',
  pro_forma_sensitivity: 'Sensitivity Analysis',
  text_block: 'Text Block',
  status_badge: 'Status Badge',
};

export const DraggableSection: React.FC<DraggableSectionProps> = ({
  section,
  onToggle,
  onRemove,
  onExpand,
  isDragging = false,
  isOverlay = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const sectionName = section.name || SECTION_TYPE_NAMES[section.type] || section.type;
  const dragging = isDragging || isSortableDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group flex items-center gap-3 p-3 rounded-xl
        border transition-all duration-200
        ${dragging
          ? 'bg-primary-container border-primary shadow-lg scale-[1.02] z-50'
          : section.enabled
            ? 'bg-surface-container-low border-outline-variant hover:border-primary/50'
            : 'bg-surface-container border-outline-variant opacity-60'
        }
        ${isOverlay ? 'shadow-2xl' : ''}
      `}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className={`
          p-1.5 rounded-lg cursor-grab active:cursor-grabbing
          text-on-surface-variant hover:text-primary hover:bg-primary/10
          transition-colors duration-150
          ${dragging ? 'cursor-grabbing text-primary' : ''}
        `}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Expand/Collapse Toggle */}
      {onExpand && (
        <button
          onClick={() => onExpand(section.id)}
          className="p-1 rounded text-on-surface-variant hover:text-primary transition-colors"
        >
          {section.collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Section Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${section.enabled ? 'text-on-surface' : 'text-on-surface-variant'}`}>
            {sectionName}
          </span>
          {section.required && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-error/10 text-error rounded">
              Required
            </span>
          )}
        </div>
        {section.description && !section.collapsed && (
          <p className="text-xs text-on-surface-variant mt-0.5 truncate">
            {section.description}
          </p>
        )}
      </div>

      {/* Toggle Visibility */}
      <button
        onClick={() => onToggle(section.id)}
        disabled={section.required}
        className={`
          p-2 rounded-lg transition-colors duration-150
          ${section.required
            ? 'opacity-30 cursor-not-allowed'
            : section.enabled
              ? 'text-primary hover:bg-primary/10'
              : 'text-on-surface-variant hover:bg-surface-container'
          }
        `}
        title={section.required ? 'This section is required' : section.enabled ? 'Hide section' : 'Show section'}
      >
        {section.enabled ? (
          <Eye className="w-4 h-4" />
        ) : (
          <EyeOff className="w-4 h-4" />
        )}
      </button>

      {/* Remove (optional sections only) */}
      {onRemove && !section.required && (
        <button
          onClick={() => onRemove(section.id)}
          className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors duration-150 opacity-0 group-hover:opacity-100"
          title="Remove section"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// Static preview version (no drag functionality)
export const SectionPreview: React.FC<{
  section: SectionItem;
  compact?: boolean;
}> = ({ section, compact = false }) => {
  const sectionName = section.name || SECTION_TYPE_NAMES[section.type] || section.type;

  return (
    <div
      className={`
        flex items-center gap-2 px-3 rounded-lg border border-outline-variant
        ${compact ? 'py-1.5' : 'py-2'}
        ${section.enabled ? 'bg-surface-container-low' : 'bg-surface-container opacity-50'}
      `}
    >
      <span className={`text-xs ${section.enabled ? 'text-on-surface' : 'text-on-surface-variant'}`}>
        {sectionName}
      </span>
      {section.required && (
        <span className="px-1 py-0.5 text-[8px] font-medium bg-primary/10 text-primary rounded">
          Required
        </span>
      )}
    </div>
  );
};

export default DraggableSection;
