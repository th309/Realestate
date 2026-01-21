/**
 * Data Alerts Service
 *
 * Manages data-related alerts including creation, acknowledgment, and resolution.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface DataAlert {
  id: string;
  alertType: 'source_unavailable' | 'source_stale' | 'pipeline_failed' | 'schema_change' | 'coverage_drop';
  severity: 'critical' | 'warning' | 'info';
  sourceName?: string;
  pipelineName?: string;
  title: string;
  message: string;
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface DataAlertsResponse {
  alerts: DataAlert[];
  summary: {
    total: number;
    open: number;
    acknowledged: number;
    resolved: number;
    critical: number;
    warning: number;
  };
}

@Injectable()
export class DataAlertsService {
  private readonly logger = new Logger(DataAlertsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async getAlerts(filters?: {
    status?: string;
    severity?: string;
    type?: string;
  }): Promise<DataAlertsResponse> {
    const client = this.supabase.getClient();

    try {
      let query = client
        .from('data_ingest_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.severity && filters.severity !== 'all') {
        query = query.eq('severity', filters.severity);
      }
      if (filters?.type && filters.type !== 'all') {
        query = query.eq('alert_type', filters.type);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.warn(`Error fetching alerts: ${error.message}`);
        return {
          alerts: [],
          summary: this.calculateSummary([]),
        };
      }

      const alerts: DataAlert[] = (data || []).map((row) => ({
        id: row.id,
        alertType: row.alert_type,
        severity: row.severity,
        sourceName: row.source_name,
        pipelineName: row.pipeline_name,
        title: row.title,
        message: row.message,
        status: row.status,
        createdAt: row.created_at,
        acknowledgedAt: row.acknowledged_at,
        acknowledgedBy: row.acknowledged_by,
        resolvedAt: row.resolved_at,
        resolvedBy: row.resolved_by,
      }));

      return {
        alerts,
        summary: this.calculateSummary(alerts),
      };
    } catch (error) {
      this.logger.error('Error fetching alerts:', error);
      return {
        alerts: [],
        summary: this.calculateSummary([]),
      };
    }
  }

  async acknowledgeAlert(alertId: string, userId?: string): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    try {
      const { error } = await client
        .from('data_ingest_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: userId || 'system',
        })
        .eq('id', alertId);

      if (error) {
        this.logger.error(`Error acknowledging alert ${alertId}:`, error);
        return { success: false };
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Error acknowledging alert ${alertId}:`, error);
      return { success: false };
    }
  }

  async resolveAlert(alertId: string, userId?: string, notes?: string): Promise<{ success: boolean }> {
    const client = this.supabase.getClient();

    try {
      const { error } = await client
        .from('data_ingest_alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: userId || 'system',
          resolution_notes: notes,
        })
        .eq('id', alertId);

      if (error) {
        this.logger.error(`Error resolving alert ${alertId}:`, error);
        return { success: false };
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Error resolving alert ${alertId}:`, error);
      return { success: false };
    }
  }

  async createAlert(alert: Omit<DataAlert, 'id' | 'status' | 'createdAt'>): Promise<{ success: boolean; id?: string }> {
    const client = this.supabase.getClient();

    try {
      const { data, error } = await client
        .from('data_ingest_alerts')
        .insert({
          alert_type: alert.alertType,
          severity: alert.severity,
          source_name: alert.sourceName,
          pipeline_name: alert.pipelineName,
          title: alert.title,
          message: alert.message,
          status: 'open',
        })
        .select('id')
        .single();

      if (error) {
        this.logger.error('Error creating alert:', error);
        return { success: false };
      }

      return { success: true, id: data?.id };
    } catch (error) {
      this.logger.error('Error creating alert:', error);
      return { success: false };
    }
  }

  private calculateSummary(alerts: DataAlert[]) {
    return {
      total: alerts.length,
      open: alerts.filter((a) => a.status === 'open').length,
      acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
      resolved: alerts.filter((a) => a.status === 'resolved').length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
    };
  }

}
