/**
 * Alerts Service
 *
 * CRUD operations for user metric alerts backed by
 * the user_alerts and alert_history tables.
 */

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

export interface UserAlert {
  id: string;
  user_id: string;
  geography_type: string;
  geography_id: string;
  geography_name: string | null;
  metric_id: string;
  condition: 'above' | 'below' | 'crosses';
  threshold: number;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertHistoryEntry {
  id: string;
  alert_id: string;
  triggered_at: string;
  metric_value: number;
  notified_via: 'in-app' | 'email' | 'both';
  read_at: string | null;
}

export interface CreateAlertDto {
  geography_type: string;
  geography_id: string;
  geography_name?: string;
  metric_id: string;
  condition: 'above' | 'below' | 'crosses';
  threshold: number;
}

export interface UpdateAlertDto {
  condition?: 'above' | 'below' | 'crosses';
  threshold?: number;
  is_active?: boolean;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * List all alerts for a user, each enriched with its latest 3 history entries.
   */
  async listAlerts(userId: string): Promise<(UserAlert & { recent_history: AlertHistoryEntry[] })[]> {
    const client = this.supabase.getClient();

    const { data: alerts, error } = await client
      .from('user_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list alerts: ${error.message}`);
      throw new Error(error.message);
    }

    if (!alerts?.length) return [];

    // Fetch latest 3 history entries per alert
    const alertIds = alerts.map((a) => a.id);
    const { data: history } = await client
      .from('alert_history')
      .select('*')
      .in('alert_id', alertIds)
      .order('triggered_at', { ascending: false });

    const historyByAlert: Record<string, AlertHistoryEntry[]> = {};
    for (const entry of history || []) {
      if (!historyByAlert[entry.alert_id]) {
        historyByAlert[entry.alert_id] = [];
      }
      if (historyByAlert[entry.alert_id].length < 3) {
        historyByAlert[entry.alert_id].push(entry);
      }
    }

    return alerts.map((alert) => ({
      ...alert,
      recent_history: historyByAlert[alert.id] || [],
    }));
  }

  /**
   * Create a new alert, enforcing the entitlements alerts_limit.
   */
  async createAlert(userId: string, dto: CreateAlertDto): Promise<UserAlert> {
    // Check entitlements limit
    const limitCheck = await this.checkAlertsLimit(userId);
    if (!limitCheck.allowed) {
      throw new HttpException(
        'Alerts limit reached. Upgrade your plan to create more alerts.',
        HttpStatus.FORBIDDEN,
      );
    }

    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('user_alerts')
      .insert({
        user_id: userId,
        geography_type: dto.geography_type,
        geography_id: dto.geography_id,
        geography_name: dto.geography_name || null,
        metric_id: dto.metric_id,
        condition: dto.condition,
        threshold: dto.threshold,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create alert: ${error.message}`);
      throw new Error(error.message);
    }

    this.logger.log(
      `Created alert for user ${userId}: ${dto.metric_id} ${dto.condition} ${dto.threshold} on ${dto.geography_type}/${dto.geography_id}`,
    );
    return data;
  }

  /**
   * Update an alert's threshold, condition, or active status. Verifies ownership.
   */
  async updateAlert(userId: string, alertId: string, dto: UpdateAlertDto): Promise<UserAlert> {
    const client = this.supabase.getClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.condition !== undefined) updateData.condition = dto.condition;
    if (dto.threshold !== undefined) updateData.threshold = dto.threshold;
    if (dto.is_active !== undefined) updateData.is_active = dto.is_active;

    const { data, error } = await client
      .from('user_alerts')
      .update(updateData)
      .eq('id', alertId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new HttpException('Alert not found', HttpStatus.NOT_FOUND);
      }
      this.logger.error(`Failed to update alert: ${error.message}`);
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Delete an alert. Verifies ownership via user_id filter.
   */
  async deleteAlert(userId: string, alertId: string): Promise<void> {
    const client = this.supabase.getClient();

    // Verify ownership first
    const { data: existing, error: lookupError } = await client
      .from('user_alerts')
      .select('id')
      .eq('id', alertId)
      .eq('user_id', userId)
      .single();

    if (lookupError || !existing) {
      throw new HttpException('Alert not found', HttpStatus.NOT_FOUND);
    }

    const { error } = await client
      .from('user_alerts')
      .delete()
      .eq('id', alertId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to delete alert: ${error.message}`);
      throw new Error(error.message);
    }

    this.logger.log(`Deleted alert ${alertId}`);
  }

  /**
   * Get triggered alert history for a user's alerts, ordered by triggered_at DESC.
   * Returns entries plus an unread count.
   */
  async getHistory(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ entries: AlertHistoryEntry[]; unread_count: number }> {
    const client = this.supabase.getClient();
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    // Get all alert IDs belonging to this user
    const { data: userAlerts } = await client
      .from('user_alerts')
      .select('id')
      .eq('user_id', userId);

    if (!userAlerts?.length) {
      return { entries: [], unread_count: 0 };
    }

    const alertIds = userAlerts.map((a) => a.id);

    // Fetch history entries
    const { data: entries, error } = await client
      .from('alert_history')
      .select('*')
      .in('alert_id', alertIds)
      .order('triggered_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(`Failed to get alert history: ${error.message}`);
      throw new Error(error.message);
    }

    // Get unread count
    const { count: unreadCount } = await client
      .from('alert_history')
      .select('*', { count: 'exact', head: true })
      .in('alert_id', alertIds)
      .is('read_at', null);

    return {
      entries: entries || [],
      unread_count: unreadCount || 0,
    };
  }

  /**
   * Mark a history entry as read. Verifies ownership through alert_id -> user_alerts.
   */
  async markRead(userId: string, historyId: string): Promise<void> {
    const client = this.supabase.getClient();

    // Fetch the history entry to get its alert_id
    const { data: entry, error: entryError } = await client
      .from('alert_history')
      .select('alert_id')
      .eq('id', historyId)
      .single();

    if (entryError || !entry) {
      throw new HttpException('History entry not found', HttpStatus.NOT_FOUND);
    }

    // Verify ownership: the alert must belong to this user
    const { data: alert, error: alertError } = await client
      .from('user_alerts')
      .select('id')
      .eq('id', entry.alert_id)
      .eq('user_id', userId)
      .single();

    if (alertError || !alert) {
      throw new HttpException('History entry not found', HttpStatus.NOT_FOUND);
    }

    const { error } = await client
      .from('alert_history')
      .update({ read_at: new Date().toISOString() })
      .eq('id', historyId);

    if (error) {
      this.logger.error(`Failed to mark history as read: ${error.message}`);
      throw new Error(error.message);
    }
  }

  /**
   * Check if the user is within their alerts limit.
   */
  private async checkAlertsLimit(
    userId: string,
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const currentCount = await this.getCount(userId);
    const entitlementsResult = await this.entitlements.checkAccess(
      userId,
      null,
      ['feature:alerts_limit'],
    );
    const access = entitlementsResult.access['feature:alerts_limit'];

    // -1 means unlimited, undefined/0 means no access
    const limit = access?.limit ?? 0;
    if (limit === -1) return { allowed: true, current: currentCount, limit: -1 };

    return { allowed: currentCount < limit, current: currentCount, limit };
  }

  /**
   * Get count of alerts for a user.
   */
  private async getCount(userId: string): Promise<number> {
    const client = this.supabase.getClient();

    const { count, error } = await client
      .from('user_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to get alerts count: ${error.message}`);
      return 0;
    }

    return count || 0;
  }
}
