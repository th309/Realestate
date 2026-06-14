export const CHART_TOKENS = {
  primary: "var(--md-primary)",
  positive: "var(--md-tertiary)",
  negative: "var(--md-error)",
  caution: "var(--md-warning)",
  neutral: "var(--md-on-surface-variant)",
  gridline: "var(--md-outline-variant)",
  benchmark: {
    poor: "var(--md-error-container)",
    good: "var(--md-tertiary-container)",
    great: "var(--md-tertiary)",
  },
} as const;

export const CHART_HEIGHTS = {
  desktop: 280,
  tablet: 240,
  mobile: 200,
  sparkline: 28,
} as const;
