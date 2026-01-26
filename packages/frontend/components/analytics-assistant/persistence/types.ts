/**
 * Persistence Types for Analytics Assistant
 */

export interface SavedQuery {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  query_text: string;
  query_params?: Record<string, unknown>;
  result_type?: string;
  is_favorite: boolean;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  geography_type: string;
  geography_id: string;
  geography_name?: string;
  tags?: string[];
  folder?: string;
  added_at: string;
  score_at_add?: number;
}

export interface Note {
  id: string;
  user_id: string;
  geography_type: string;
  geography_id: string;
  content: string;
  reminder_at?: string;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolsUsed?: string[];
}

export interface Conversation {
  id: string;
  user_id: string;
  conversation_id: string;
  title?: string;
  messages: ConversationMessage[];
  context?: Record<string, unknown>;
  message_count: number;
  last_message_at?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}
