"use client";

import React, { useState, useCallback } from "react";
import { Target, BarChart3, Map, TrendingUp, FileText } from "lucide-react";
import { ScoreConfigurator } from "./configurator/ScoreConfigurator";
import { MetricConfigurator } from "./configurator/MetricConfigurator";
import { MapConfigurator } from "./configurator/MapConfigurator";
import { ChartConfigurator } from "./configurator/ChartConfigurator";
import { ReportConfigurator } from "./configurator/ReportConfigurator";
import {
  ShapeSizeSelector,
  getDimensions,
  type Shape,
  type Size,
} from "./configurator/ShapeSizeSelector";
import { EmbedPreview } from "./configurator/EmbedPreview";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WidgetConfiguratorProps {
  token: string;
}

type WidgetType = "score" | "metric_card" | "map" | "chart" | "report";

interface WidgetTypeOption {
  type: WidgetType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

/* ------------------------------------------------------------------ */
/*  Widget type definitions                                            */
/* ------------------------------------------------------------------ */

const WIDGET_TYPES: WidgetTypeOption[] = [
  {
    type: "score",
    label: "Score Widget",
    icon: Target,
    description: "PropertyIQ score ring with grade and confidence",
  },
  {
    type: "metric_card",
    label: "Metric Card",
    icon: BarChart3,
    description: "Single metric with value, trend, and sparkline",
  },
  {
    type: "map",
    label: "Interactive Map",
    icon: Map,
    description: "Choropleth map with configurable UI controls",
  },
  {
    type: "chart",
    label: "Chart",
    icon: TrendingUp,
    description: "Time-series chart with multi-location comparison",
  },
  {
    type: "report",
    label: "Report",
    icon: FileText,
    description: "Embeddable full-page market report",
  },
];

/* ------------------------------------------------------------------ */
/*  Configurator renderer                                              */
/* ------------------------------------------------------------------ */

function ActiveConfigurator({
  widgetType,
  onUrlChange,
}: {
  widgetType: WidgetType;
  onUrlChange: (url: string | null) => void;
}) {
  switch (widgetType) {
    case "score":
      return <ScoreConfigurator onUrlChange={onUrlChange} />;
    case "metric_card":
      return <MetricConfigurator onUrlChange={onUrlChange} />;
    case "map":
      return <MapConfigurator onUrlChange={onUrlChange} />;
    case "chart":
      return <ChartConfigurator onUrlChange={onUrlChange} />;
    case "report":
      return <ReportConfigurator onUrlChange={onUrlChange} />;
  }
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function WidgetConfigurator({ token }: WidgetConfiguratorProps) {
  const [selectedType, setSelectedType] = useState<WidgetType>("score");
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [shape, setShape] = useState<Shape>("horizontal");
  const [size, setSize] = useState<Size>("medium");

  const handleUrlChange = useCallback((url: string | null) => {
    setEmbedUrl(url);
  }, []);

  const handleTypeChange = useCallback((type: WidgetType) => {
    setSelectedType(type);
    setEmbedUrl(null);
  }, []);

  const dimensions = getDimensions(shape, size);

  /* No token — show setup prompt */
  if (!token) {
    return (
      <section className="bg-surface-container-low rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-medium text-on-surface mb-1">
          Widget Configurator
        </h2>
        <div className="rounded-xl border border-outline-variant bg-surface-container px-6 py-8 text-center mt-4">
          <p className="text-sm text-on-surface-variant">
            Create an embed token first to preview widgets.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-surface-container-low rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-medium text-on-surface mb-1">
        Widget Configurator
      </h2>
      <p className="text-sm text-on-surface-variant mb-5">
        Select a widget type, configure its options, then preview and copy the
        embed code.
      </p>

      {/* ---- Step 1: Widget type selector ---- */}
      <div className="flex flex-wrap gap-3 mb-6">
        {WIDGET_TYPES.map(({ type, label, icon: Icon, description }) => (
          <button
            key={type}
            type="button"
            onClick={() => handleTypeChange(type)}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors flex-1 min-w-[170px] ${
              selectedType === type
                ? "border-primary bg-primary/5"
                : "border-outline-variant hover:border-primary/50"
            }`}
          >
            <Icon
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                selectedType === type
                  ? "text-primary"
                  : "text-on-surface-variant"
              }`}
            />
            <div>
              <span className="text-sm font-medium text-on-surface block">
                {label}
              </span>
              <span className="text-xs text-on-surface-variant">
                {description}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* ---- Step 2: Active configurator ---- */}
      <div className="rounded-xl border border-outline-variant bg-surface p-5 mb-6">
        <ActiveConfigurator
          key={selectedType}
          widgetType={selectedType}
          onUrlChange={handleUrlChange}
        />
      </div>

      {/* ---- Step 3: Shape & size selector ---- */}
      <div className="mb-6">
        <ShapeSizeSelector
          shape={shape}
          size={size}
          onShapeChange={setShape}
          onSizeChange={setSize}
        />
      </div>

      {/* ---- Step 4: Live preview ---- */}
      {embedUrl && (
        <EmbedPreview
          embedUrl={embedUrl}
          width={dimensions.w}
          height={dimensions.h}
          token={token}
        />
      )}
    </section>
  );
}
