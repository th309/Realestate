'use client';

import React from 'react';
import { Settings, X, Info } from 'lucide-react';
import type { BuilderSection } from '../hooks/useBuilderState';
import { SECTION_TEMPLATES } from '../hooks/useBuilderState';

interface PropertyPanelProps {
  section: BuilderSection | null;
  onUpdateConfig: (id: string, config: Record<string, unknown>) => void;
  onClose: () => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  section,
  onUpdateConfig,
  onClose,
}) => {
  if (!section) {
    return (
      <div className="h-full flex flex-col bg-surface-container rounded-2xl border border-outline-variant overflow-hidden">
        <div className="p-4 border-b border-outline-variant">
          <h3 className="text-base font-medium text-on-surface">Properties</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Settings className="w-12 h-12 text-on-surface-variant opacity-20 mb-3" />
          <p className="text-sm text-on-surface-variant">
            Select a section on the canvas to edit its properties
          </p>
        </div>
      </div>
    );
  }

  const template = SECTION_TEMPLATES[section.type];
  const sectionName = section.name || template?.name || section.type;

  const handleConfigChange = (key: string, value: unknown) => {
    onUpdateConfig(section.id, { [key]: value });
  };

  return (
    <div className="h-full flex flex-col bg-surface-container rounded-2xl border border-outline-variant overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-outline-variant">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-on-surface">{sectionName}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {template?.description && (
          <p className="text-xs text-on-surface-variant mt-1">{template.description}</p>
        )}
      </div>

      {/* Properties Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {renderSectionProperties(section, handleConfigChange)}
      </div>

      {/* Info Footer */}
      <div className="p-3 border-t border-outline-variant bg-surface-container-low">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-on-surface-variant shrink-0 mt-0.5" />
          <p className="text-xs text-on-surface-variant">
            Changes are applied automatically. The report preview will update in real-time.
          </p>
        </div>
      </div>
    </div>
  );
};

// Common input styles
const selectClassName = "w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";
const textareaClassName = "w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface-container-low text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none";

// Render properties based on section type
function renderSectionProperties(
  section: BuilderSection,
  onChange: (key: string, value: unknown) => void
) {
  const config = section.config;

  switch (section.type) {
    case 'report_title':
      return (
        <>
          <PropertyField label="Title Variant">
            <select
              value={(config.variant as string) || 'hero'}
              onChange={(e) => onChange('variant', e.target.value)}
              className={selectClassName}
            >
              <option value="hero">Hero (Large)</option>
              <option value="standard">Standard</option>
              <option value="minimal">Minimal</option>
            </select>
          </PropertyField>
          <PropertyField label="Show Subtitle">
            <PropertyToggle
              checked={(config.showSubtitle as boolean) ?? true}
              onChange={(v) => onChange('showSubtitle', v)}
            />
          </PropertyField>
        </>
      );

    case 'score_gauge_single':
    case 'score_gauge_dual':
      return (
        <>
          <PropertyField label="Score Type">
            <select
              value={(config.scoreType as string) || 'homeready'}
              onChange={(e) => onChange('scoreType', e.target.value)}
              className={selectClassName}
            >
              <option value="homeready">HomeReady Score</option>
              <option value="investoredge">InvestorEdge Score</option>
            </select>
          </PropertyField>
          <PropertyField label="Show Components">
            <PropertyToggle
              checked={(config.showComponents as boolean) ?? false}
              onChange={(v) => onChange('showComponents', v)}
            />
          </PropertyField>
          <PropertyField label="Show Trend">
            <PropertyToggle
              checked={(config.showTrend as boolean) ?? true}
              onChange={(v) => onChange('showTrend', v)}
            />
          </PropertyField>
        </>
      );

    case 'metric_grid':
      return (
        <>
          <PropertyField label="Columns">
            <select
              value={(config.columns as number) || 3}
              onChange={(e) => onChange('columns', parseInt(e.target.value))}
              className={selectClassName}
            >
              <option value={2}>2 Columns</option>
              <option value={3}>3 Columns</option>
              <option value={4}>4 Columns</option>
            </select>
          </PropertyField>
          <PropertyField label="Show Trends">
            <PropertyToggle
              checked={(config.showTrends as boolean) ?? true}
              onChange={(v) => onChange('showTrends', v)}
            />
          </PropertyField>
          <PropertyField label="Compact Mode">
            <PropertyToggle
              checked={(config.compact as boolean) ?? false}
              onChange={(v) => onChange('compact', v)}
            />
          </PropertyField>
        </>
      );

    case 'chart_single':
    case 'chart_grid':
      return (
        <>
          <PropertyField label="Chart Type">
            <select
              value={(config.chartType as string) || 'area'}
              onChange={(e) => onChange('chartType', e.target.value)}
              className={selectClassName}
            >
              <option value="area">Area Chart</option>
              <option value="line">Line Chart</option>
              <option value="bar">Bar Chart</option>
            </select>
          </PropertyField>
          <PropertyField label="Show Legend">
            <PropertyToggle
              checked={(config.showLegend as boolean) ?? true}
              onChange={(v) => onChange('showLegend', v)}
            />
          </PropertyField>
          <PropertyField label="Time Period">
            <select
              value={(config.period as string) || '5Y'}
              onChange={(e) => onChange('period', e.target.value)}
              className={selectClassName}
            >
              <option value="1Y">1 Year</option>
              <option value="3Y">3 Years</option>
              <option value="5Y">5 Years</option>
              <option value="10Y">10 Years</option>
              <option value="Max">All Time</option>
            </select>
          </PropertyField>
        </>
      );

    case 'ai_narrative':
      return (
        <>
          <PropertyField label="Max Length">
            <select
              value={(config.maxTokens as number) || 500}
              onChange={(e) => onChange('maxTokens', parseInt(e.target.value))}
              className={selectClassName}
            >
              <option value={250}>Brief (~250 words)</option>
              <option value={500}>Standard (~500 words)</option>
              <option value={1000}>Detailed (~1000 words)</option>
            </select>
          </PropertyField>
          <PropertyField label="Include Data Citations">
            <PropertyToggle
              checked={(config.includeCitations as boolean) ?? true}
              onChange={(v) => onChange('includeCitations', v)}
            />
          </PropertyField>
        </>
      );

    case 'comparison_table':
      return (
        <>
          <PropertyField label="Show Rankings">
            <PropertyToggle
              checked={(config.showRankings as boolean) ?? true}
              onChange={(v) => onChange('showRankings', v)}
            />
          </PropertyField>
          <PropertyField label="Highlight Best">
            <PropertyToggle
              checked={(config.highlightBest as boolean) ?? true}
              onChange={(v) => onChange('highlightBest', v)}
            />
          </PropertyField>
          <PropertyField label="Compact Mode">
            <PropertyToggle
              checked={(config.compact as boolean) ?? false}
              onChange={(v) => onChange('compact', v)}
            />
          </PropertyField>
        </>
      );

    case 'text_block':
      return (
        <>
          <PropertyField label="Content">
            <textarea
              value={(config.content as string) || ''}
              onChange={(e) => onChange('content', e.target.value)}
              placeholder="Enter your text content..."
              className={textareaClassName}
              rows={4}
            />
          </PropertyField>
          <PropertyField label="Style">
            <select
              value={(config.style as string) || 'normal'}
              onChange={(e) => onChange('style', e.target.value)}
              className={selectClassName}
            >
              <option value="normal">Normal</option>
              <option value="callout">Callout Box</option>
              <option value="quote">Quote</option>
              <option value="note">Note</option>
            </select>
          </PropertyField>
        </>
      );

    default:
      return (
        <div className="text-sm text-on-surface-variant text-center py-4">
          <p>No configurable properties for this section type.</p>
          <p className="text-xs mt-1">Section ID: {section.id}</p>
        </div>
      );
  }
}

// Property field wrapper
const PropertyField: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
      {label}
    </label>
    {children}
  </div>
);

// Toggle component
const PropertyToggle: React.FC<{
  checked: boolean;
  onChange: (value: boolean) => void;
}> = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`
      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
      ${checked ? 'bg-primary' : 'bg-on-surface/20'}
    `}
  >
    <span
      className={`
        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
        ${checked ? 'translate-x-6' : 'translate-x-1'}
      `}
    />
  </button>
);

export default PropertyPanel;
