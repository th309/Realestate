/**
 * Threshold Alert Service
 *
 * Monthly cron job (1st of month, 2PM UTC — after scoring pipeline)
 * that evaluates score-based alerts and sends email notifications.
 *
 * Flow:
 * 1. Fetch all active score-based alerts
 * 2. Batch-fetch latest scores from propertyiq_scores
 * 3. Evaluate each alert's threshold condition
 * 4. Send email via EmailService + ThresholdAlert template
 * 5. Log to alert_history and update last_triggered_at (dedup)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ThresholdAlert } from '@propertyiq/emails';
import React from 'react';
import { EmailService } from '../email/email.service';
import { ThresholdAlertDataService } from './threshold-alert-data.service';
import { RedisLockService } from '../redis/redis-lock.service';
import { AlertsService } from './alerts.service';
import { PushService } from '../push/push.service';
import {
  ActiveAlert,
  ScoreRow,
  SCORE_METRIC_COLUMNS,
  checkThreshold,
  wasTriggeredThisMonth,
} from './threshold-alert.types';

@Injectable()
export class ThresholdAlertService {
  private readonly logger = new Logger(ThresholdAlertService.name);
  private readonly appUrl: string;

  constructor(
    private readonly alertData: ThresholdAlertDataService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly redis: RedisLockService,
    private readonly alertsService: AlertsService,
    private readonly pushService: PushService,
  ) {
    this.appUrl =
      this.config.get<string>('FRONTEND_URL') || 'https://propertyiq.app';
  }

  /**
   * Runs on the 1st of each month at 2PM UTC, after the scoring pipeline.
   */
  @Cron('0 14 1 * *')
  async processThresholdAlerts(): Promise<void> {
    const locked = await this.redis.acquireLock('cron:threshold-alerts', 600);
    if (!locked) {
      this.logger.log(
        'Another instance is processing threshold alerts, skipping',
      );
      return;
    }

    try {
      await this.processThresholdAlertsInner();
    } finally {
      await this.redis.releaseLock('cron:threshold-alerts');
    }
  }

  private async processThresholdAlertsInner(): Promise<void> {
    this.logger.log('Starting monthly threshold alert processing...');

    const alerts = await this.alertData.fetchActiveScoreAlerts();
    if (!alerts.length) {
      this.logger.log('No active score-based alerts to process');
      return;
    }

    const scoreMap = await this.alertData.batchFetchScores(alerts);
    const userEmails = await this.alertData.batchFetchUserEmails(alerts);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const alert of alerts) {
      try {
        const result = await this.evaluateAndNotify(
          alert,
          scoreMap,
          userEmails,
        );
        if (result === 'sent') sent++;
        else skipped++;
      } catch (err) {
        this.logger.error(
          `Failed to process alert ${alert.id}: ${err instanceof Error ? err.message : err}`,
        );
        failed++;
      }
    }

    this.logger.log(
      `Threshold alert processing complete. Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`,
    );
  }

  /**
   * Evaluate a single alert and send email if threshold is crossed.
   */
  private async evaluateAndNotify(
    alert: ActiveAlert,
    scoreMap: Map<string, ScoreRow>,
    userEmails: Map<string, string | null>,
  ): Promise<'sent' | 'skipped'> {
    const email = userEmails.get(alert.user_id);
    if (!email) return 'skipped';

    if (wasTriggeredThisMonth(alert.last_triggered_at)) return 'skipped';

    const geoKey = `${alert.geography_type}:${alert.geography_id}`;
    const scoreRow = scoreMap.get(geoKey);
    if (!scoreRow) return 'skipped';

    const column = SCORE_METRIC_COLUMNS[alert.metric_id];
    if (!column) return 'skipped';

    const currentScore = scoreRow[column] as number | null;
    if (currentScore == null) return 'skipped';

    if (!checkThreshold(alert.condition, currentScore, alert.threshold)) {
      return 'skipped';
    }

    const direction: 'above' | 'below' =
      currentScore >= alert.threshold ? 'above' : 'below';
    const scoreType = alert.metric_id.replace('_score', '');
    const marketName = alert.geography_name || alert.geography_id;

    const success = await this.sendAlertEmail(
      alert,
      email,
      marketName,
      scoreType,
      Math.round(currentScore),
      direction,
    );

    if (!success) return 'skipped';

    await this.alertData.recordTrigger(alert.id, currentScore);
    await this.sendThresholdPush(
      alert,
      marketName,
      scoreType,
      currentScore,
      direction,
    );
    return 'sent';
  }

  /**
   * Push notification alongside the email — mirrors the daily alert-processor
   * wiring. Never throws: a push failure must not affect the 'sent' result
   * (the email already succeeded), so this is fully isolated.
   */
  private async sendThresholdPush(
    alert: ActiveAlert,
    marketName: string,
    scoreType: string,
    currentScore: number,
    direction: 'above' | 'below',
  ): Promise<void> {
    try {
      const badgeCount = await this.alertsService.getUnreadCount(alert.user_id);
      const directionLabel =
        direction === 'above' ? 'rose above' : 'dropped below';
      await this.pushService.sendToUser(alert.user_id, {
        title: `${marketName} score alert`,
        body: `${scoreType} score ${directionLabel} ${alert.threshold} (now ${Math.round(currentScore)})`,
        url: '/alerts',
        badgeCount,
      });
    } catch (err) {
      this.logger.error(
        `Push notification failed for threshold alert ${alert.id}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async sendAlertEmail(
    alert: ActiveAlert,
    email: string,
    marketName: string,
    scoreType: string,
    currentScore: number,
    direction: 'above' | 'below',
  ): Promise<boolean> {
    const displayName = email.split('@')[0];
    const mapUrl = `${this.appUrl}/map?geo=${alert.geography_type}&id=${alert.geography_id}`;
    const preferencesUrl = `${this.appUrl}/account/notifications`;

    const react = React.createElement(ThresholdAlert, {
      name: displayName,
      marketName,
      scoreType,
      currentScore,
      threshold: alert.threshold,
      direction,
      mapUrl,
      preferencesUrl,
    });

    const directionLabel =
      direction === 'above' ? 'rose above' : 'dropped below';

    return this.emailService.sendEmail({
      to: email,
      subject: `Score Alert: ${marketName} ${directionLabel} ${alert.threshold} on ${scoreType}`,
      react,
      userId: alert.user_id,
      emailType: 'threshold_alert',
      metadata: {
        alertId: alert.id,
        metricId: alert.metric_id,
        currentScore,
        threshold: alert.threshold,
        direction,
      },
    });
  }
}
