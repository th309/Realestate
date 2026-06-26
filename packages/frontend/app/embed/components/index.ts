/**
 * Embed Widget Components
 *
 * Reusable components for embeddable PropertyIQ widgets.
 * All widgets are designed for iframe embedding on third-party sites.
 */

// Shell & branding
export {
  EmbedShell,
  EmbedBrandingContext,
  useEmbedBranding,
} from "./EmbedShell";
export {
  EmbedBrandingBar,
  type EmbedBrandingBarProps,
} from "./EmbedBrandingBar";

// Loading & error states
export {
  EmbedLoadingSkeleton,
  type EmbedLoadingSkeletonProps,
} from "./EmbedLoadingSkeleton";
export { EmbedErrorState, type EmbedErrorStateProps } from "./EmbedErrorState";

// Widget components
export { EmbedScoreRing, type EmbedScoreRingProps } from "./EmbedScoreRing";
export { EmbedMetricCard, type EmbedMetricCardProps } from "./EmbedMetricCard";
export {
  EmbedMiniMap,
  type EmbedMiniMapProps,
  type EmbedMapDataEntry,
} from "./EmbedMiniMap";

// Sub-components (exposed for advanced customization)
export { EmbedMapLegend, type EmbedMapLegendProps } from "./embed-map-legend";
export {
  EmbedMapTooltip,
  type TooltipData,
  type EmbedMapTooltipProps,
} from "./embed-map-tooltip";
