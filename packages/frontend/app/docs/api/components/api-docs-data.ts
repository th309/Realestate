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

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

export const TABS = [
  { id: "getting-started", label: "Getting Started" },
  { id: "use-cases", label: "Use Cases" },
  { id: "reference", label: "API Reference" },
  { id: "troubleshooting", label: "Troubleshooting" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export const DEFAULT_TAB: TabId = "getting-started";

// ---------------------------------------------------------------------------
// Use case metadata
// ---------------------------------------------------------------------------

export interface UseCaseData {
  id: string;
  title: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  setupTime: string;
  icon: string;
}

export const USE_CASES: UseCaseData[] = [
  {
    id: "auto-generate-reports",
    title: "Auto-Generate Reports",
    description: "Create client-ready market reports on demand",
    difficulty: "Beginner",
    setupTime: "5 min",
    icon: "FileText",
  },
  {
    id: "embed-score",
    title: "Embed a Score on Your Website",
    description:
      "Show a live PropertyIQ score on Wix, Squarespace, or WordPress",
    difficulty: "Beginner",
    setupTime: "10 min",
    icon: "Code",
  },
  {
    id: "google-sheets",
    title: "Pull Data into Google Sheets",
    description:
      "Get market metrics into a spreadsheet that updates automatically",
    difficulty: "Beginner",
    setupTime: "10 min",
    icon: "Table",
  },
  {
    id: "client-alerts",
    title: "Automated Client Alerts",
    description: "Email clients when their market score changes significantly",
    difficulty: "Intermediate",
    setupTime: "15 min",
    icon: "Bell",
  },
  {
    id: "market-comparison",
    title: "Market Comparison for Listing Presentations",
    description: "Pull side-by-side data for two markets to win a listing",
    difficulty: "Intermediate",
    setupTime: "10 min",
    icon: "BarChart3",
  },
  {
    id: "monthly-newsletter",
    title: "Monthly Market Newsletter",
    description: "Auto-generate a monthly market update email for your sphere",
    difficulty: "Intermediate",
    setupTime: "20 min",
    icon: "Mail",
  },
  {
    id: "market-pages",
    title: "Website Market Pages",
    description: "Create dynamic market pages that update automatically",
    difficulty: "Advanced",
    setupTime: "30 min",
    icon: "Globe",
  },
  {
    id: "investor-pipeline",
    title: "Investor Pipeline Scoring",
    description: "Score and rank every market in your investment pipeline",
    difficulty: "Intermediate",
    setupTime: "15 min",
    icon: "TrendingUp",
  },
  {
    id: "slack-alerts",
    title: "Slack/Teams Market Alerts",
    description: "Get a daily market summary posted to your team channel",
    difficulty: "Intermediate",
    setupTime: "15 min",
    icon: "MessageSquare",
  },
  {
    id: "crm-dashboard",
    title: "Connect to Your CRM or Dashboard",
    description: "Feed PropertyIQ data into your internal tools",
    difficulty: "Advanced",
    setupTime: "30 min",
    icon: "Plug",
  },
];

// ---------------------------------------------------------------------------
// Scope to endpoint anchor mapping (for clickable scope badges)
// ---------------------------------------------------------------------------

export const SCOPE_ANCHORS: Record<string, string> = {
  "scores:read": "endpoint-scores",
  "metrics:read": "endpoint-metrics",
  "rankings:read": "endpoint-rankings",
  "reports:read": "endpoint-reports",
  "reports:write": "endpoint-reports",
  "watchlist:read": "endpoint-watchlist",
  "watchlist:write": "endpoint-watchlist",
};
