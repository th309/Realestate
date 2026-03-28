import type { EmbedConfig } from "@/lib/data";

export type WidgetType =
  | "score"
  | "metric_card"
  | "map"
  | "map_full"
  | "chart"
  | "report";

export interface WidgetTypeOption {
  type: WidgetType;
  label: string;
  description: string;
  iconName: string;
}

export const WIDGET_TYPES: WidgetTypeOption[] = [
  {
    type: "score",
    label: "Score Ring",
    description: "Show a PropertyIQ score for any market",
    iconName: "Target",
  },
  {
    type: "metric_card",
    label: "Single Metric",
    description: "One key number with trend arrow",
    iconName: "BarChart3",
  },
  {
    type: "map",
    label: "Map Snapshot",
    description: "A small choropleth map",
    iconName: "Map",
  },
  {
    type: "map_full",
    label: "Interactive Map",
    description: "Full map visitors can explore",
    iconName: "Globe",
  },
  {
    type: "chart",
    label: "Trend Chart",
    description: "Compare trends across locations",
    iconName: "TrendingUp",
  },
  {
    type: "report",
    label: "Full Report",
    description: "Embed an entire market report",
    iconName: "FileText",
  },
];

/** Widget types that use responsive sizing instead of shape/size selector */
export const RESPONSIVE_WIDGET_TYPES: WidgetType[] = ["map_full", "report"];

/** Maps widget type to display label */
export const WIDGET_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  WIDGET_TYPES.map((w) => [w.type, w.label]),
);

export type { EmbedConfig };
