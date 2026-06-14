'use client';

import React, { useEffect, useState } from 'react';
import { TrendingUp, ScatterChart, BarChart3, Radar, AlignLeft } from 'lucide-react';
import { PLATFORM_TEMPLATES, type GraphTemplate } from '../constants/templates';
import type { GraphsState } from '../hooks/useGraphsState';
import type { ChartType } from '../hooks/useGraphsState';

const CHART_TYPE_ICONS: Record<ChartType, React.ElementType> = {
  timeseries: TrendingUp,
  scatter: ScatterChart,
  waterfall: BarChart3,
  radar: Radar,
  bar: AlignLeft,
};

interface TemplatePickerProps {
  onApply: (config: Partial<GraphsState>) => void;
  /** Horizontal row layout (below chart) vs vertical list (sidebar) */
  horizontal?: boolean;
  className?: string;
}

const STORAGE_KEY = 'propertyiq-user-templates';

function loadUserTemplates(): GraphTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function TemplatePicker({ onApply, horizontal, className }: TemplatePickerProps) {
  const [userTemplates, setUserTemplates] = useState<GraphTemplate[]>([]);

  useEffect(() => {
    setUserTemplates(loadUserTemplates());
  }, []);

  // Listen for storage changes (e.g. after saving a new template)
  useEffect(() => {
    const onStorage = () => setUserTemplates(loadUserTemplates());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const allTemplates = [...PLATFORM_TEMPLATES, ...userTemplates];

  if (horizontal) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider flex-shrink-0">
            Templates
          </span>
          {allTemplates.map((template) => {
            const chartType = template.config.chartType as ChartType | undefined;
            const Icon = chartType ? CHART_TYPE_ICONS[chartType] : TrendingUp;
            return (
              <button
                key={template.id}
                onClick={() => onApply(template.config)}
                title={template.description}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all whitespace-nowrap flex-shrink-0"
              >
                <Icon className="w-3 h-3" />
                {template.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Platform Templates */}
      <div className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2 px-1">
        Templates
      </div>
      <div className="flex flex-col gap-1">
        {PLATFORM_TEMPLATES.map((template) => (
          <TemplateCard key={template.id} template={template} onApply={onApply} />
        ))}
      </div>

      {/* User Templates */}
      {userTemplates.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2 px-1 mt-4">
            Your Templates
          </div>
          <div className="flex flex-col gap-1">
            {userTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} onApply={onApply} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onApply,
}: {
  template: GraphTemplate;
  onApply: (config: Partial<GraphsState>) => void;
}) {
  const chartType = template.config.chartType as ChartType | undefined;
  const Icon = chartType ? CHART_TYPE_ICONS[chartType] : TrendingUp;

  return (
    <button
      onClick={() => onApply(template.config)}
      className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-container-high transition-colors duration-150 group flex items-start gap-2"
    >
      <Icon className="w-3.5 h-3.5 text-on-surface-variant mt-0.5 flex-shrink-0 group-hover:text-primary transition-colors" />
      <div className="min-w-0">
        <div className="text-xs font-medium text-on-surface truncate">{template.name}</div>
        <div className="text-[10px] text-on-surface-variant leading-tight">{template.description}</div>
      </div>
    </button>
  );
}

export default TemplatePicker;
