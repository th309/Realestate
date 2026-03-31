/**
 * Available personal API key scopes.
 * Shared between CreateKeyForm and PersonalApiKeyCard for consistent labels.
 */
export const AVAILABLE_SCOPES = [
  { value: "scores:read", label: "Scores (read)" },
  { value: "metrics:read", label: "Metrics (read)" },
  { value: "rankings:read", label: "Rankings (read)" },
  { value: "reports:read", label: "Reports (read)" },
  { value: "watchlist:read", label: "Watchlist (read)" },
] as const;

export type ScopeValue = (typeof AVAILABLE_SCOPES)[number]["value"];
