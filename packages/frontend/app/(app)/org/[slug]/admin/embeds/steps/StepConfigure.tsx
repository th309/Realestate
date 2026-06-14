"use client";

import React, { useState, useCallback } from "react";
import { type WidgetType, RESPONSIVE_WIDGET_TYPES } from "../embed-builder-types";
import { ScoreConfigurator } from "../configurator/ScoreConfigurator";
import { MetricConfigurator } from "../configurator/MetricConfigurator";
import { MapConfigurator } from "../configurator/MapConfigurator";
import { ChartConfigurator } from "../configurator/ChartConfigurator";
import { ReportConfigurator } from "../configurator/ReportConfigurator";
import {
  ShapeSizeSelector,
  getDimensions,
  type Shape,
  type Size,
} from "../configurator/ShapeSizeSelector";
import { EmbedPreview } from "../configurator/EmbedPreview";

interface StepConfigureProps {
  widgetType: WidgetType;
  token: string;
  shape: Shape;
  size: Size;
  onShapeChange: (s: Shape) => void;
  onSizeChange: (s: Size) => void;
  websiteUrl: string;
  onWebsiteUrlChange: (url: string) => void;
  onEmbedUrlChange: (url: string | null) => void;
  embedUrl: string | null;
}

function extractOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return null;
  }
}

function isValidUrl(value: string): boolean {
  if (!value) return true;
  return /^https?:\/\/.+/.test(value);
}

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
    case "map_full":
      return <MapConfigurator onUrlChange={onUrlChange} />;
    case "chart":
      return <ChartConfigurator onUrlChange={onUrlChange} />;
    case "report":
      return <ReportConfigurator onUrlChange={onUrlChange} />;
    default:
      return null;
  }
}

export function StepConfigure({
  widgetType,
  token,
  shape,
  size,
  onShapeChange,
  onSizeChange,
  websiteUrl,
  onWebsiteUrlChange,
  onEmbedUrlChange,
  embedUrl,
}: StepConfigureProps) {
  const [urlTouched, setUrlTouched] = useState(false);

  const showShapeSize = !RESPONSIVE_WIDGET_TYPES.includes(widgetType);
  const dims = getDimensions(shape, size);
  const urlValid = isValidUrl(websiteUrl);
  const extractedOrigin = websiteUrl ? extractOrigin(websiteUrl) : null;

  const handleUrlBlur = useCallback(() => {
    setUrlTouched(true);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left: Configuration */}
      <div className="flex-1 space-y-6 min-w-0">
        <h3 className="text-lg font-medium text-on-surface">
          Configure your widget
        </h3>

        <div className="space-y-4">
          <ActiveConfigurator
            widgetType={widgetType}
            onUrlChange={onEmbedUrlChange}
          />
        </div>

        {showShapeSize && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-on-surface">
              Shape & Size
            </label>
            <ShapeSizeSelector
              shape={shape}
              size={size}
              onShapeChange={onShapeChange}
              onSizeChange={onSizeChange}
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-on-surface">
            Where will you put this embed?
          </label>
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => onWebsiteUrlChange(e.target.value)}
            onBlur={handleUrlBlur}
            placeholder="https://yourbrokerage.com"
            className={`w-full h-12 px-4 bg-surface border rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors duration-200 ${
              urlTouched && websiteUrl && !urlValid
                ? "border-red-500"
                : "border-outline-variant"
            }`}
          />
          {urlTouched && websiteUrl && !urlValid ? (
            <p className="text-xs text-red-500">
              Enter a valid URL starting with http:// or https://
            </p>
          ) : extractedOrigin && extractedOrigin !== websiteUrl ? (
            <p className="text-xs text-on-surface-variant">
              We&apos;ll restrict the embed to{" "}
              <span className="font-medium">{extractedOrigin}</span>
            </p>
          ) : (
            <p className="text-xs text-on-surface-variant">
              We&apos;ll make sure the embed only works on this website.
            </p>
          )}
        </div>
      </div>

      {/* Right: Live Preview */}
      <div className="lg:w-[420px] shrink-0">
        {embedUrl && token ? (
          <div className="sticky top-4">
            <label className="text-sm font-medium text-on-surface mb-2 block">
              Live Preview
            </label>
            <EmbedPreview
              embedUrl={embedUrl}
              width={showShapeSize ? dims.w : 400}
              height={showShapeSize ? dims.h : 300}
              token={token}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 rounded-xl border-2 border-dashed border-outline-variant text-on-surface-variant text-sm">
            Configure the widget to see a preview
          </div>
        )}
      </div>
    </div>
  );
}
