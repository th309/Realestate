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
import { ReportAiService } from './report-ai.service';
import { NewsScoutService } from './news-scout.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Dependencies required only by `streamConversationMessage`. */
export interface ConversationDeps {
  reportAiService: ReportAiService;
  newsScoutService: NewsScoutService;
  entitlementsService: EntitlementsService;
  /** Callback that fetches a full report record (populated_data, etc.). */
  getReport: (reportId: string, userId: string) => Promise<any>;
}

// ---------------------------------------------------------------------------
// Conversation helpers
// ---------------------------------------------------------------------------

/** SSE event shape yielded by streamConversationMessage(), mirrored on the frontend. */
export type ConversationStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'done' }
  | { type: 'error'; content: string };

/**
 * Send a user message in a report conversation and stream the AI response.
 *
 * Creates the conversation row if it does not exist yet, checks the user's AI
 * entitlement, streams the AI's reply as it's generated, then persists the
 * full exchange once the stream ends.
 */
export async function* streamConversationMessage(
  supabase: SupabaseClient,
  deps: ConversationDeps,
  reportId: string,
  userId: string,
  content: string,
): AsyncGenerator<ConversationStreamEvent> {
  // Get report for context — validated before touching report_conversations so
  // a bad/foreign reportId errors cleanly instead of creating an orphan row.
  const report = await deps.getReport(reportId, userId);
  if (!report) {
    yield { type: 'error', content: 'Report not found' };
    return;
  }

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
    newsContext = deps.newsScoutService.formatNewsForPrompt(newsResult as any, {
      maxNewsItems: 5,
      includeIndicators: true,
      includeSignals: true,
      includeNational: true,
    });
  }

  // Check AI entitlement before generating conversation response
  // Tier resolved server-side from validated userId; never trust client tier.
  const convAiAccess = await deps.entitlementsService.checkAccess(
    userId,
    null,
    ['feature:ai_insights'],
  );
  if (convAiAccess.access['feature:ai_insights']?.level !== 'full') {
    yield {
      type: 'text',
      content:
        'AI-powered conversation requires an Enterprise plan. Upgrade to unlock AI chat for your reports.',
    };
    yield { type: 'done' };
    return;
  }

  // Stream the AI response, accumulating the full text for persistence
  let response = '';
  for await (const delta of deps.reportAiService.streamConversationResponse(
    content,
    conversation.messages || [],
    report,
    newsContext,
  )) {
    response += delta;
    yield { type: 'text', content: delta };
  }

  // Persist the full exchange now that the stream has ended
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

  yield { type: 'done' };
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
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
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
