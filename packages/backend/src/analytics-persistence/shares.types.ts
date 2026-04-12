/**
 * Shares Types
 *
 * Type definitions for shareable analytics links.
 */

export interface Share {
  id: string;
  user_id: string;
  share_token: string;
  title?: string;
  description?: string;
  content_type:
    | 'query_result'
    | 'comparison'
    | 'chart'
    | 'conversation'
    | 'report'
    | 'market_share';
  content: ShareContent;
  is_public: boolean;
  password_hash?: string;
  allowed_emails?: string[];
  expires_at?: string;
  max_views?: number;
  view_count: number;
  created_at: string;
}

export interface ShareContent {
  query?: string;
  result?: unknown;
  chart_config?: unknown;
  conversation_id?: string;
  geographies?: Array<{
    type: string;
    id: string;
    name?: string;
  }>;
  metrics?: string[];
  date_range?: {
    start: string;
    end: string;
  };
  // Market share fields
  market?: {
    geoLevel: string;
    geoId: string;
    geoName: string;
    score?: number;
    homeValue?: string;
    appreciation?: string;
    dom?: string;
    supply?: string;
    channel?: string;
  };
}

export interface CreateShareDto {
  title?: string;
  description?: string;
  content_type: Share['content_type'];
  content: ShareContent;
  is_public?: boolean;
  password?: string;
  allowed_emails?: string[];
  expires_in_days?: number;
  max_views?: number;
}
