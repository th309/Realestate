/**
 * Report Sharing & Conversation Utilities
 *
 * Standalone functions for report conversation (AI chat) and share-link
 * management. Extracted from ReportsService so the logic can be invoked
 * without instantiating the full reports module.
 *
 * Every function receives its required dependencies as explicit parameters
 * rather than relying on `this` / class state.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { ClaudeService } from './claude.service';
import { ClaudeNewsService } from './claude-news.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Dependencies required only by `sendConversationMessage`. */
export interface ConversationDeps {
  claudeService: ClaudeService;
  claudeNewsService: ClaudeNewsService;
  entitlementsService: EntitlementsService;
  /** Callback that fetches a full report record (populated_data, etc.). */
  getReport: (reportId: string, userId: string) => Promise<any>;
}

// ---------------------------------------------------------------------------
// Conversation helpers
// ---------------------------------------------------------------------------

/**
 * Send a user message in a report conversation and generate an AI response.
 *
 * Creates the conversation row if it does not exist yet, checks the user's AI
 * entitlement, asks Claude for a response, then persists the new exchange.
 */
export async function sendConversationMessage(
  supabase: SupabaseClient,
  deps: ConversationDeps,
  reportId: string,
  userId: string,
  content: string,
  userTier?: string,
): Promise<any> {
  // Get or create conversation
  let { data: conversation } = await supabase
    .from('report_conversations')
    .select('*')
    .eq('report_id', reportId)
    .eq('user_id', userId)
    .single();

  if (!conversation) {
    const { data: newConv, error } = await supabase
      .from('report_conversations')
      .insert({
        report_id: reportId,
        user_id: userId,
        messages: [],
        exchange_count: 0,
      })
      .select()
      .single();

    if (error) throw error;
    conversation = newConv;
  }

  // Get report for context
  const report = await deps.getReport(reportId, userId);

  // Extract news context from report's realtime data if available
  let newsContext: string | undefined;
  const realtimeData = report.populated_data?.realtime;
  if (realtimeData && realtimeData.news && realtimeData.news.length > 0) {
    const newsResult = {
      local_news: realtimeData.news,
      economic_indicators: realtimeData.indicators || [],
      market_signals: realtimeData.signals || [],
      national_context: realtimeData.national_context,
    };
    newsContext = deps.claudeNewsService.formatNewsForPrompt(
      newsResult as any,
      {
        maxNewsItems: 5,
        includeIndicators: true,
        includeSignals: true,
        includeNational: true,
      },
    );
  }

  // Check AI entitlement before generating conversation response
  const convAiAccess = await deps.entitlementsService.checkAccess(
    userId,
    userTier || null,
    ['feature:ai_insights'],
  );
  if (convAiAccess.access['feature:ai_insights']?.level !== 'full') {
    return {
      messages: [
        ...(conversation.messages || []),
        {
          id: Date.now().toString(),
          role: 'user',
          content,
          timestamp: new Date().toISOString(),
        },
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content:
            'AI-powered conversation requires an Enterprise plan. Upgrade to unlock AI chat for your reports.',
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  // Generate AI response
  const response = await deps.claudeService.generateConversationResponse(
    content,
    conversation.messages || [],
    report,
    newsContext,
  );

  // Update conversation
  const messages = [
    ...(conversation.messages || []),
    {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    },
    {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
    },
  ];

  await supabase
    .from('report_conversations')
    .update({
      messages,
      exchange_count: (conversation.exchange_count || 0) + 1,
      last_message_at: new Date().toISOString(),
    })
    .eq('id', conversation.id);

  return {
    response,
    exchange_count: (conversation.exchange_count || 0) + 1,
    limit_reached: false,
  };
}

// ---------------------------------------------------------------------------
// Conversation retrieval
// ---------------------------------------------------------------------------

/**
 * Fetch the conversation history for a report + user pair.
 */
export async function getConversation(
  supabase: SupabaseClient,
  reportId: string,
  userId: string,
): Promise<any> {
  const { data } = await supabase
    .from('report_conversations')
    .select('*')
    .eq('report_id', reportId)
    .eq('user_id', userId)
    .single();

  return data;
}

// ---------------------------------------------------------------------------
// Share-link management
// ---------------------------------------------------------------------------

/**
 * Create a shareable token for a report.
 *
 * Generates a cryptographically random 32-byte hex token, persists it on the
 * report row along with the chosen access level and optional expiry.
 */
export async function createShareLink(
  supabase: SupabaseClient,
  reportId: string,
  userId: string,
  accessLevel: 'view' | 'download',
  expiresInDays?: number,
): Promise<string> {
  const shareToken = randomBytes(32).toString('hex');
  const expiresAt = expiresInDays
    ? new Date(
        Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
      ).toISOString()
    : null;

  const { error } = await supabase
    .from('reports')
    .update({
      share_token: shareToken,
      share_access_level: accessLevel,
      share_expires_at: expiresAt,
    })
    .eq('id', reportId)
    .eq('user_id', userId);

  if (error) throw error;
  return shareToken;
}

/**
 * Retrieve a shared report by its share token.
 *
 * Returns `null` when the token is invalid or has expired. Automatically
 * increments the view count on each successful retrieval.
 */
export async function getSharedReport(
  supabase: SupabaseClient,
  token: string,
): Promise<any> {
  const { data, error } = await supabase
    .from('reports')
    .select(
      `
      *,
      template:report_templates(slug, name, icon, config)
    `,
    )
    .eq('share_token', token)
    .or('share_expires_at.is.null,share_expires_at.gt.now()')
    .single();

  if (error || !data) return null;

  // Increment view count
  await supabase
    .from('reports')
    .update({ share_view_count: (data.share_view_count || 0) + 1 })
    .eq('id', data.id);

  return data;
}
