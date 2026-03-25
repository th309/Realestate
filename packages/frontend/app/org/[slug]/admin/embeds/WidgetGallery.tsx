"use client";

import React, { useState, useMemo } from "react";
import { BarChart3, Map, Target, Copy, Check } from "lucide-react";
import { ScoreMockup, MetricCardMockup, MapMockup } from "./WidgetMockups";

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                 */
/* ------------------------------------------------------------------ */

type WidgetType = "score" | "metric_card" | "map";
type Shape = "square" | "horizontal" | "vertical";
type Size = "small" | "medium" | "large";

const WIDGETS = [
  {
    type: "score" as const,
    label: "Score Widget",
    icon: Target,
    description: "PropertyIQ score ring with grade and confidence",
  },
  {
    type: "metric_card" as const,
    label: "Metric Card",
    icon: BarChart3,
    description: "Single metric with value, trend, and sparkline",
  },
  {
    type: "map" as const,
    label: "Map Widget",
    icon: Map,
    description: "Choropleth map with color-coded metric data",
  },
];

const SHAPES: { shape: Shape; label: string }[] = [
  { shape: "square", label: "Square" },
  { shape: "horizontal", label: "Horizontal" },
  { shape: "vertical", label: "Vertical" },
];

const SIZES: { size: Size; label: string }[] = [
  { size: "small", label: "Small" },
  { size: "medium", label: "Medium" },
  { size: "large", label: "Large" },
];

/** Pixel dimensions for each widget type + shape + size combination. */
const DIMENSIONS: Record<
  WidgetType,
  Record<Shape, Record<Size, { w: number; h: number }>>
> = {
  score: {
    square: {
      small: { w: 200, h: 200 },
      medium: { w: 300, h: 300 },
      large: { w: 400, h: 400 },
    },
    horizontal: {
      small: { w: 400, h: 200 },
      medium: { w: 500, h: 200 },
      large: { w: 600, h: 200 },
    },
    vertical: {
      small: { w: 200, h: 300 },
      medium: { w: 200, h: 400 },
      large: { w: 250, h: 450 },
    },
  },
  metric_card: {
    square: {
      small: { w: 200, h: 200 },
      medium: { w: 300, h: 300 },
      large: { w: 400, h: 400 },
    },
    horizontal: {
      small: { w: 400, h: 150 },
      medium: { w: 500, h: 150 },
      large: { w: 600, h: 150 },
    },
    vertical: {
      small: { w: 200, h: 300 },
      medium: { w: 200, h: 350 },
      large: { w: 250, h: 400 },
    },
  },
  map: {
    square: {
      small: { w: 300, h: 300 },
      medium: { w: 400, h: 400 },
      large: { w: 500, h: 500 },
    },
    horizontal: {
      small: { w: 600, h: 300 },
      medium: { w: 700, h: 300 },
      large: { w: 800, h: 300 },
    },
    vertical: {
      small: { w: 300, h: 400 },
      medium: { w: 300, h: 500 },
      large: { w: 350, h: 550 },
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function PillToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full bg-surface-container-high p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-primary text-on-primary"
              : "text-on-surface-variant hover:bg-surface-container-low"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may not be available in embed contexts */
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-on-primary hover:bg-primary/90 transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          Copy Code
        </>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Mockup renderer dispatch                                          */
/* ------------------------------------------------------------------ */

function WidgetPreview({
  widgetType,
  shape,
}: {
  widgetType: WidgetType;
  shape: Shape;
}) {
  switch (widgetType) {
    case "score":
      return <ScoreMockup shape={shape} />;
    case "metric_card":
      return <MetricCardMockup shape={shape} />;
    case "map":
      return <MapMockup shape={shape} />;
  }
}

/* ------------------------------------------------------------------ */
/*  Main Gallery                                                      */
/* ------------------------------------------------------------------ */

export function WidgetGallery() {
  const [selectedType, setSelectedType] = useState<WidgetType>("score");
  const [selectedShape, setSelectedShape] = useState<Shape>("square");
  const [selectedSize, setSelectedSize] = useState<Size>("medium");

  const dims = DIMENSIONS[selectedType][selectedShape][selectedSize];

  const embedSnippet = useMemo(
    () =>
      `<iframe\n  src="https://embed.propertyiq.app/v1/${selectedType}?token=YOUR_TOKEN"\n  width="${dims.w}"\n  height="${dims.h}"\n  style="border:none; border-radius:12px;"\n  loading="lazy"\n></iframe>`,
    [selectedType, dims.w, dims.h],
  );

  const activeWidget = WIDGETS.find((w) => w.type === selectedType)!;

  return (
    <section className="bg-surface-container-low rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-medium text-on-surface mb-1">
        Widget Examples
      </h2>
      <p className="text-sm text-on-surface-variant mb-5">
        Preview how each widget type looks at different shapes and sizes, then
        copy the embed code.
      </p>

      {/* Widget type selector */}
      <div className="flex flex-wrap gap-3 mb-5">
        {WIDGETS.map(({ type, label, icon: Icon, description }) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors flex-1 min-w-[180px] ${
              selectedType === type
                ? "border-primary bg-primary/5"
                : "border-outline-variant hover:bg-surface-container-high"
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

      {/* Shape & size toggles */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
            Shape
          </span>
          <PillToggle
            options={SHAPES.map((s) => ({ value: s.shape, label: s.label }))}
            value={selectedShape}
            onChange={setSelectedShape}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
            Size
          </span>
          <PillToggle
            options={SIZES.map((s) => ({ value: s.size, label: s.label }))}
            value={selectedSize}
            onChange={setSelectedSize}
          />
        </div>
        <span className="text-xs text-on-surface-variant ml-auto">
          {dims.w} &times; {dims.h}px
        </span>
      </div>

      {/* Live preview */}
      <div className="flex justify-center mb-6 p-6 rounded-xl bg-surface-container-high/50 border border-outline-variant/30">
        <div
          className="rounded-xl border border-outline-variant bg-surface overflow-hidden transition-all duration-300"
          style={{ width: dims.w, height: dims.h, maxWidth: "100%" }}
        >
          <WidgetPreview widgetType={selectedType} shape={selectedShape} />
        </div>
      </div>

      {/* Embed code */}
      <div className="rounded-xl bg-surface-container-high border border-outline-variant/30 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant/30">
          <span className="text-xs font-medium text-on-surface-variant">
            Embed code for {activeWidget.label}
          </span>
          <CopyButton text={embedSnippet} />
        </div>
        <pre className="p-4 text-xs text-on-surface-variant font-mono overflow-x-auto whitespace-pre">
          {embedSnippet}
        </pre>
      </div>
    </section>
  );
}
