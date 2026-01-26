/**
 * Shares Service
 *
 * Manages shareable links for analytics content.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as crypto from 'crypto';

export interface Share {
  id: string;
  user_id: string;
  share_token: string;
  title?: string;
  description?: string;
  content_type: 'query_result' | 'comparison' | 'chart' | 'conversation' | 'report';
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

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Generate a unique share token
   */
  private generateToken(): string {
    return crypto.randomBytes(16).toString('base64url');
  }

  /**
   * Hash a password for protected shares
   */
  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Get all shares for a user
   */
  async getAll(userId: string): Promise<Share[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_shares')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to get shares: ${error.message}`);
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get a share by token (public access)
   */
  async getByToken(token: string): Promise<Share | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_shares')
      .select('*')
      .eq('share_token', token)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Get share by ID (owner access)
   */
  async getById(userId: string, shareId: string): Promise<Share | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_shares')
      .select('*')
      .eq('id', shareId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Create a shareable link
   */
  async create(userId: string, dto: CreateShareDto): Promise<Share> {
    const client = this.supabase.getClient();

    const token = this.generateToken();
    const expiresAt = dto.expires_in_days
      ? new Date(Date.now() + dto.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error } = await client
      .from('analytics_shares')
      .insert({
        user_id: userId,
        share_token: token,
        title: dto.title,
        description: dto.description,
        content_type: dto.content_type,
        content: dto.content,
        is_public: dto.is_public ?? true,
        password_hash: dto.password ? this.hashPassword(dto.password) : null,
        allowed_emails: dto.allowed_emails,
        expires_at: expiresAt,
        max_views: dto.max_views,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    this.logger.log(`Created share for user ${userId}: ${token}`);
    return data;
  }

  /**
   * Access a share (increments view count, checks access)
   */
  async access(
    token: string,
    options?: { password?: string; email?: string },
  ): Promise<{ share: Share; accessGranted: boolean; reason?: string }> {
    const share = await this.getByToken(token);

    if (!share) {
      return { share: null as any, accessGranted: false, reason: 'Share not found' };
    }

    // Check expiration
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return { share, accessGranted: false, reason: 'Share has expired' };
    }

    // Check view limit
    if (share.max_views && share.view_count >= share.max_views) {
      return { share, accessGranted: false, reason: 'View limit reached' };
    }

    // Check password
    if (share.password_hash) {
      if (!options?.password) {
        return { share, accessGranted: false, reason: 'Password required' };
      }
      if (this.hashPassword(options.password) !== share.password_hash) {
        return { share, accessGranted: false, reason: 'Invalid password' };
      }
    }

    // Check allowed emails
    if (share.allowed_emails && share.allowed_emails.length > 0) {
      if (!options?.email || !share.allowed_emails.includes(options.email)) {
        return { share, accessGranted: false, reason: 'Email not authorized' };
      }
    }

    // Increment view count
    await this.incrementViewCount(share.id);

    return { share, accessGranted: true };
  }

  /**
   * Increment view count
   */
  private async incrementViewCount(shareId: string): Promise<void> {
    const client = this.supabase.getClient();

    await client.rpc('increment_share_views', { share_id: shareId });
  }

  /**
   * Delete a share
   */
  async delete(userId: string, shareId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('analytics_shares')
      .delete()
      .eq('id', shareId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    this.logger.log(`Deleted share ${shareId}`);
  }

  /**
   * Update share settings
   */
  async update(
    userId: string,
    shareId: string,
    updates: Partial<{
      title: string;
      description: string;
      is_public: boolean;
      password: string;
      allowed_emails: string[];
      expires_at: string;
      max_views: number;
    }>,
  ): Promise<Share> {
    const client = this.supabase.getClient();

    const updateData: Record<string, unknown> = { ...updates };
    if (updates.password) {
      updateData.password_hash = this.hashPassword(updates.password);
      delete updateData.password;
    }

    const { data, error } = await client
      .from('analytics_shares')
      .update(updateData)
      .eq('id', shareId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Get share count for a user
   */
  async getCount(userId: string): Promise<number> {
    const client = this.supabase.getClient();

    const { count, error } = await client
      .from('analytics_shares')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    return count || 0;
  }
}
