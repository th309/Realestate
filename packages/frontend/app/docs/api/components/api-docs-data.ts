/**
 * Static data constants for the API documentation page.
 * Extracted to keep page.tsx under the 400-line component limit.
 */

export const NAV_SECTIONS = [
  { id: "getting-started", label: "Getting Started" },
  { id: "authentication", label: "Authentication" },
  { id: "rate-limiting", label: "Rate Limiting" },
  { id: "response-format", label: "Response Format" },
  { id: "endpoints", label: "Endpoints" },
  { id: "error-codes", label: "Error Codes" },
  { id: "code-examples", label: "Code Examples" },
];

export const SCOPES = [
  {
    scope: "scores:read",
    description: "Read PropertyIQ scores for any geography",
  },
  {
    scope: "metrics:read",
    description: "Read metric values and time series data",
  },
  { scope: "rankings:read", description: "Read market ranking leaderboards" },
  { scope: "reports:read", description: "Read generated market reports" },
  { scope: "reports:write", description: "Trigger new report generation" },
  { scope: "watchlist:read", description: "Read watchlist entries" },
  { scope: "watchlist:write", description: "Add or remove watchlist entries" },
];

export const ERROR_CODES = [
  {
    code: "UNAUTHORIZED",
    status: 401,
    description: "Missing or invalid API key",
  },
  {
    code: "API_KEY_REVOKED",
    status: 401,
    description: "The API key has been revoked",
  },
  {
    code: "API_KEY_EXPIRED",
    status: 401,
    description: "The API key has expired",
  },
  {
    code: "INSUFFICIENT_SCOPE",
    status: 403,
    description: "API key lacks the required scope for this endpoint",
  },
  {
    code: "INVALID_GEO_LEVEL",
    status: 400,
    description: "Geography level must be one of: state, metro, county, zip",
  },
  {
    code: "METRIC_NOT_FOUND",
    status: 404,
    description: "The requested metric ID does not exist",
  },
  {
    code: "RATE_LIMIT_EXCEEDED",
    status: 429,
    description: "Too many requests — retry after the Retry-After interval",
  },
  {
    code: "INTERNAL_ERROR",
    status: 500,
    description: "Unexpected server error — contact support if it persists",
  },
];
