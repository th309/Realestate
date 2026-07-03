export interface HealthSnapshot {
  id: string;
  timestamp: string;
  source_name: string;
  available: boolean;
  fresh: boolean;
  days_since_update: number | null;
  response_time_ms: number | null;
  error_message: string | null;
}

export interface ApiMetricRow {
  id: string;
  timestamp: string;
  endpoint: string;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  request_count: number;
  error_count: number;
  error_rate: number;
}

export interface CacheMetricRow {
  id: string;
  timestamp: string;
  hit_count: number;
  miss_count: number;
  hit_rate: number;
  eviction_count: number;
  memory_used_bytes: number;
  keys_count: number;
}

export interface AlertRow {
  id: string;
  alert_type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  source: string;
  triggered_at: string;
  resolved_at: string | null;
  acknowledged: boolean;
  metadata: Record<string, unknown>;
}

export interface ScoreSnapshot {
  id: string;
  timestamp: string;
  score_type: string;
  correlation_1y: number | null;
  hit_rate_1y: number | null;
  scores_validated: number;
  scores_pending: number;
  scores_failed: number;
}

export interface UserSnapshot {
  id: string;
  timestamp: string;
  total_users: number;
  new_signups: number;
  active_trials: number;
  expiring_soon: number;
  tier_free: number;
  tier_starter: number;
  tier_pro: number;
  tier_enterprise: number;
  paywall_views: number;
  conversions: number;
  mrr_cents: number;
}

export interface PageViewRow {
  id: string;
  timestamp: string;
  page_path: string;
  view_count: number;
  unique_visitors: number;
  avg_session_duration_ms: number;
  bounce_rate: number;
}

export interface ApiTimingEntry {
  endpoint: string;
  duration_ms: number;
  status_code: number;
  timestamp: number;
}

export interface HeroStats {
  system_health: { uptime_pct: number; sparkline: number[] };
  active_alerts: {
    count: number;
    critical: number;
    warning: number;
    sparkline: number[];
  };
  data_freshness: { fresh: number; total: number; sparkline: number[] };
  total_users: { count: number; new_this_week: number; sparkline: number[] };
  score_health: { hit_rate_1y: number | null; sparkline: number[] };
}
