/**
 * AlertPersistenceService
 *
 * Handles reading and writing alert rows in the `admin_alerts` table.
 * Consumed by AlertEvaluationService to create and resolve alerts without
 * duplicating open alerts on repeated cron evaluations.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AlertRow } from '../admin-metrics.types';

type AlertSeverity = AlertRow['severity'];

@Injectable()
export class AlertPersistenceService {
  private readonly logger = new Logger(AlertPersistenceService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Creates a new open alert of the given type only if one does not already
   * exist. Prevents duplicate alert flooding on repeated cron evaluations.
   */
  async ensureAlertExists(
    alertType: string,
    severity: AlertSeverity,
    source: string,
    message: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const client = this.supabase.getClient();

    const { data: existing, error: fetchError } = await client
      .from('admin_alerts')
      .select('id')
      .eq('alert_type', alertType)
      .is('resolved_at', null)
      .limit(1);

    if (fetchError) {
      this.logger.error(
        `[AlertPersistence] Failed to check existing alert (${alertType}): ${fetchError.message}`,
      );
      return;
    }

    if (existing && existing.length > 0) {
      // Active alert already exists — no duplicate needed.
      return;
    }

    const { error: insertError } = await client.from('admin_alerts').insert({
      alert_type: alertType,
      severity,
      source,
      message,
      metadata,
      triggered_at: new Date().toISOString(),
      resolved_at: null,
      acknowledged: false,
    });

    if (insertError) {
      this.logger.error(
        `[AlertPersistence] Failed to insert alert (${alertType}): ${insertError.message}`,
      );
      return;
    }

    this.logger.warn(
      `[AlertPersistence] Alert created — type=${alertType} severity=${severity} message="${message}"`,
    );
  }

  /**
   * Resolves all open alerts of the given type by setting resolved_at to now().
   * Called when a previously-breached threshold returns to a healthy state.
   */
  async autoResolveAlert(alertType: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('admin_alerts')
      .update({ resolved_at: new Date().toISOString() })
      .eq('alert_type', alertType)
      .is('resolved_at', null);

    if (error) {
      this.logger.error(
        `[AlertPersistence] Failed to auto-resolve alert (${alertType}): ${error.message}`,
      );
    }
  }
}
