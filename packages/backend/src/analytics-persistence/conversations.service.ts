/**
 * Conversations Service
 *
 * Persists and retrieves chat conversation history.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

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

export interface SaveConversationDto {
  conversation_id: string;
  title?: string;
  messages: ConversationMessage[];
  context?: Record<string, unknown>;
}

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get all conversations for a user
   */
  async getAll(userId: string, includeArchived = false): Promise<Conversation[]> {
    const client = this.supabase.getClient();

    let query = client
      .from('analytics_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to get conversations: ${error.message}`);
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get a conversation by conversation_id
   */
  async getByConversationId(
    userId: string,
    conversationId: string,
  ): Promise<Conversation | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      this.logger.error(`Failed to get conversation: ${error.message}`);
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Save or update a conversation
   */
  async save(userId: string, dto: SaveConversationDto): Promise<Conversation> {
    const client = this.supabase.getClient();

    // Check if conversation exists
    const existing = await this.getByConversationId(userId, dto.conversation_id);

    const title = dto.title || this.generateTitle(dto.messages);
    const now = new Date().toISOString();

    if (existing) {
      // Update existing
      const { data, error } = await client
        .from('analytics_conversations')
        .update({
          title,
          messages: dto.messages,
          context: dto.context,
          message_count: dto.messages.length,
          last_message_at: now,
          updated_at: now,
        })
        .eq('user_id', userId)
        .eq('conversation_id', dto.conversation_id)
        .select()
        .single();

      if (error) {
        this.logger.error(`Failed to update conversation: ${error.message}`);
        throw new Error(error.message);
      }

      return data;
    } else {
      // Create new
      const { data, error } = await client
        .from('analytics_conversations')
        .insert({
          user_id: userId,
          conversation_id: dto.conversation_id,
          title,
          messages: dto.messages,
          context: dto.context,
          message_count: dto.messages.length,
          last_message_at: now,
        })
        .select()
        .single();

      if (error) {
        this.logger.error(`Failed to create conversation: ${error.message}`);
        throw new Error(error.message);
      }

      this.logger.log(`Created conversation: ${dto.conversation_id} for user ${userId}`);
      return data;
    }
  }

  /**
   * Add a message to an existing conversation
   */
  async addMessage(
    userId: string,
    conversationId: string,
    message: ConversationMessage,
  ): Promise<Conversation> {
    const existing = await this.getByConversationId(userId, conversationId);

    if (!existing) {
      // Create new conversation with this message
      return this.save(userId, {
        conversation_id: conversationId,
        messages: [message],
      });
    }

    const messages = [...(existing.messages || []), message];

    return this.save(userId, {
      conversation_id: conversationId,
      title: existing.title,
      messages,
      context: existing.context,
    });
  }

  /**
   * Archive a conversation
   */
  async archive(userId: string, conversationId: string): Promise<boolean> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('analytics_conversations')
      .update({
        is_archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('conversation_id', conversationId);

    if (error) {
      this.logger.error(`Failed to archive conversation: ${error.message}`);
      throw new Error(error.message);
    }

    return true;
  }

  /**
   * Unarchive a conversation
   */
  async unarchive(userId: string, conversationId: string): Promise<boolean> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('analytics_conversations')
      .update({
        is_archived: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('conversation_id', conversationId);

    if (error) {
      this.logger.error(`Failed to unarchive conversation: ${error.message}`);
      throw new Error(error.message);
    }

    return true;
  }

  /**
   * Delete a conversation
   */
  async delete(userId: string, conversationId: string): Promise<boolean> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('analytics_conversations')
      .delete()
      .eq('user_id', userId)
      .eq('conversation_id', conversationId);

    if (error) {
      this.logger.error(`Failed to delete conversation: ${error.message}`);
      throw new Error(error.message);
    }

    this.logger.log(`Deleted conversation: ${conversationId}`);
    return true;
  }

  /**
   * Update conversation title
   */
  async updateTitle(
    userId: string,
    conversationId: string,
    title: string,
  ): Promise<Conversation> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_conversations')
      .update({
        title,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update title: ${error.message}`);
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Get recent conversations (last N)
   */
  async getRecent(userId: string, limit = 10): Promise<Conversation[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      this.logger.error(`Failed to get recent conversations: ${error.message}`);
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Generate a title from messages
   */
  private generateTitle(messages: ConversationMessage[]): string {
    if (!messages || messages.length === 0) {
      return 'New Conversation';
    }

    // Use the first user message as the title
    const firstUserMessage = messages.find((m) => m.role === 'user');
    if (firstUserMessage) {
      const content = firstUserMessage.content;
      // Truncate to ~50 chars
      if (content.length <= 50) return content;
      return content.slice(0, 47) + '...';
    }

    return 'New Conversation';
  }
}
