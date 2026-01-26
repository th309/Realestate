/**
 * Alerts Service
 *
 * Manages user alerts for price/score changes on markets.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface Alert {
  id: string;
  user_id: string;
  name: string;
  alert_type: 'price_change' | 'score_change' | 'threshold' | 'comparison';
  condition: AlertCondition;
  notify_email: boolean;
  notify_inapp: boolean;
  notify_sms: boolean;
  is_active: boolean;
  last_checked_at?: string;
  last_triggered_at?: string;
  trigger_count: number;
  created_at: string;
  updated_at: string;
}

export interface AlertCondition {
  geography_type: string;
  geography_id: string;
  geography_name?: string;
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'change_pct';
  value: number;
  direction?: 'up' | 'down' | 'any';
  comparison_geographies?: Array<{
    type: string;
    id: string;
    name?: string;
  }>;
}

export interface CreateAlertDto {
  name: string;
  alert_type: Alert['alert_type'];
  condition: AlertCondition;
  notify_email?: boolean;
  notify_inapp?: boolean;
  notify_sms?: boolean;
}

export interface UpdateAlertDto {
  name?: string;
  condition?: AlertCondition;
  notify_email?: boolean;
  notify_inapp?: boolean;
  notify_sms?: boolean;
  is_active?: boolean;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get all alerts for a user
   */
  async getAll(userId: string): Promise<Alert[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to get alerts: ${error.message}`);
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get active alerts only
   */
  async getActive(userId: string): Promise<Alert[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get alert by ID
   */
  async getById(userId: string, alertId: string): Promise<Alert | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_alerts')
      .select('*')
      .eq('id', alertId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Create a new alert
   */
  async create(userId: string, dto: CreateAlertDto): Promise<Alert> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_alerts')
      .insert({
        user_id: userId,
        name: dto.name,
        alert_type: dto.alert_type,
        condition: dto.condition,
        notify_email: dto.notify_email ?? true,
        notify_inapp: dto.notify_inapp ?? true,
        notify_sms: dto.notify_sms ?? false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    this.logger.log(`Created alert for user ${userId}: ${dto.name}`);
    return data;
  }

  /**
   * Update an alert
   */
  async update(userId: string, alertId: string, dto: UpdateAlertDto): Promise<Alert> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_alerts')
      .update({
        ...dto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Delete an alert
   */
  async delete(userId: string, alertId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('analytics_alerts')
      .delete()
      .eq('id', alertId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    this.logger.log(`Deleted alert ${alertId}`);
  }

  /**
   * Toggle alert active status
   */
  async toggle(userId: string, alertId: string): Promise<Alert> {
    const alert = await this.getById(userId, alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    return this.update(userId, alertId, { is_active: !alert.is_active });
  }

  /**
   * Get alert count for a user
   */
  async getCount(userId: string): Promise<number> {
    const client = this.supabase.getClient();

    const { count, error } = await client
      .from('analytics_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    return count || 0;
  }

  /**
   * Mark alert as checked
   */
  async markChecked(alertId: string): Promise<void> {
    const client = this.supabase.getClient();

    await client
      .from('analytics_alerts')
      .update({
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', alertId);
  }

  /**
   * Mark alert as triggered
   */
  async markTriggered(alertId: string): Promise<void> {
    const client = this.supabase.getClient();

    // Fetch current trigger_count first, then increment
    const { data: alert } = await client
      .from('analytics_alerts')
      .select('trigger_count')
      .eq('id', alertId)
      .single();

    const currentCount = alert?.trigger_count ?? 0;

    await client
      .from('analytics_alerts')
      .update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: currentCount + 1,
      })
      .eq('id', alertId);
  }
}
