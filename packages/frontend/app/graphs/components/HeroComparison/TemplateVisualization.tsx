'use client';

import React from 'react';
import { MyMarket } from '../../hooks/useMyMarkets';
import { TemplateType, VizType } from '../../hooks/useGraphsState';

interface TemplateVisualizationProps {
  primaryMarket: MyMarket;
  comparisonMarket: MyMarket;
  template: TemplateType;
  vizType: VizType;
  onVizTypeChange: (viz: VizType) => void;
}

const VIZ_TYPES: { id: VizType; label: string }[] = [
  { id: 'scatter', label: 'Scatter' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'trend', label: 'Trend' },
];

/**
 * TemplateVisualization - D3 visualization area with type selector
 */
export function TemplateVisualization({
  primaryMarket,
  comparisonMarket,
  template,
  vizType,
  onVizTypeChange,
}: TemplateVisualizationProps) {
  const vizInfo = getVizInfo(template, vizType);

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h4 className="text-base font-medium text-on-surface">
          {vizInfo.title}
        </h4>

        {/* Viz Type Toggle */}
        <div className="flex gap-2">
          {VIZ_TYPES.map(vt => (
            <button
              key={vt.id}
              onClick={() => onVizTypeChange(vt.id)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${vizType === vt.id
                  ? 'bg-primary text-on-primary'
                  : 'border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'
                }
              `}
            >
              {vt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Visualization Placeholder */}
      <div className="h-72 bg-surface-container-lowest rounded-xl flex items-center justify-center relative overflow-hidden">
        {/* Placeholder D3 visualization - will be replaced with actual D3 */}
        <ScatterPlotPlaceholder
          primaryMarket={primaryMarket}
          comparisonMarket={comparisonMarket}
          vizInfo={vizInfo}
        />

        {/* Axis Labels */}
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] text-on-surface-variant">
          {vizInfo.xLabel} →
        </span>
        <span className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 origin-center text-[11px] text-on-surface-variant">
          {vizInfo.yLabel} →
        </span>
      </div>
    </div>
  );
}

interface VizInfo {
  title: string;
  xLabel: string;
  yLabel: string;
}

function getVizInfo(template: TemplateType, vizType: VizType): VizInfo {
  const templateLabels: Record<TemplateType, { x: string; y: string }> = {
    affordability: { x: 'Price-to-Income Ratio', y: '5Y Appreciation' },
    investment: { x: 'Cap Rate', y: 'Appreciation' },
    momentum: { x: 'Days on Market', y: 'Inventory Change' },
    cashflow: { x: 'Rent Yield', y: 'Entry Price' },
    custom: { x: 'Selected Metric', y: 'Selected Metric' },
  };

  const labels = templateLabels[template];

  return {
    title: `${labels.x} vs ${labels.y}`,
    xLabel: labels.x,
    yLabel: labels.y,
  };
}

// Placeholder scatter plot visualization
function ScatterPlotPlaceholder({
  primaryMarket,
  comparisonMarket,
  vizInfo,
}: {
  primaryMarket: MyMarket;
  comparisonMarket: MyMarket;
  vizInfo: VizInfo;
}) {
  // Random positions for demo - in production, these come from actual data
  const points = [
    // Background points (other markets)
    { x: 25, y: 40, isPrimary: false, isComparison: false },
    { x: 30, y: 35, isPrimary: false, isComparison: false },
    { x: 35, y: 45, isPrimary: false, isComparison: false },
    { x: 55, y: 55, isPrimary: false, isComparison: false },
    { x: 60, y: 50, isPrimary: false, isComparison: false },
    { x: 65, y: 60, isPrimary: false, isComparison: false },
    { x: 45, y: 30, isPrimary: false, isComparison: false },
    { x: 70, y: 45, isPrimary: false, isComparison: false },
    // Highlighted markets
    { x: 32, y: 38, isPrimary: true, isComparison: false, name: primaryMarket.name },
    { x: 58, y: 52, isPrimary: false, isComparison: true, name: comparisonMarket.name },
  ];

  return (
    <>
      {points.map((point, i) => (
        <div
          key={i}
          className={`
            absolute rounded-full transition-all
            ${point.isPrimary || point.isComparison
              ? 'w-5 h-5 border-[3px] border-on-surface z-10'
              : 'w-3 h-3 opacity-60'
            }
            ${point.isPrimary
              ? 'bg-primary'
              : point.isComparison
                ? 'bg-tertiary'
                : 'bg-primary/50'
            }
          `}
          style={{
            left: `${point.x}%`,
            top: `${point.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
          title={point.name}
        />
      ))}

      {/* Legend */}
      <div className="absolute top-3 right-3 flex gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-on-surface-variant">{primaryMarket.name.split(',')[0]}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-tertiary" />
          <span className="text-on-surface-variant">{comparisonMarket.name.split(',')[0]}</span>
        </div>
      </div>
    </>
  );
}

export default TemplateVisualization;
