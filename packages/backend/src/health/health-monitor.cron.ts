import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSourcesHealthService } from './data-sources-health.service';
import { DataAlertsService } from './data-alerts.service';
import { PipelineRunsService } from './pipeline-runs.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class HealthMonitorCron {
  private readonly logger = new Logger(HealthMonitorCron.name);

  constructor(
    private readonly dataSourcesHealth: DataSourcesHealthService,
    private readonly dataAlerts: DataAlertsService,
    private readonly pipelineRuns: PipelineRunsService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 */6 * * *') // every 6 hours
  async runFreshnessCheck(): Promise<void> {
    this.logger.log('Running scheduled freshness check...');
    await this.checkSourceStaleness();
    await this.checkFailedPipelines();
  }

  // ── Source staleness ────────────────────────────────────────────────────────

  private async checkSourceStaleness(): Promise<void> {
    const { sources } = await this.dataSourcesHealth.checkAllSources();

    for (const source of sources) {
      if (source.fresh || source.daysSinceUpdate === null) continue;

      const isDoublyStalence =
        source.daysSinceUpdate > source.expectedFreshnessDays * 2;
      const severity: 'critical' | 'warning' = isDoublyStalence
        ? 'critical'
        : 'warning';

      const alreadyOpen = await this.dataAlerts.hasOpenAlert(
        'source_stale',
        source.sourceName,
      );
      if (alreadyOpen) continue;

      const title = `${source.displayName} data is stale (${source.daysSinceUpdate}d since last update)`;
      const message =
        `Last update: ${source.latestDate ?? 'unknown'}. ` +
        `Expected freshness: every ${source.expectedFreshnessDays} days.`;

      const result = await this.dataAlerts.createAlert({
        alertType: 'source_stale',
        severity,
        sourceName: source.sourceName,
        title,
        message,
      });

      if (result.success && severity === 'critical') {
        await this.sendCriticalAlertEmail({ title, message, sourceName: source.displayName });
      }
    }
  }

  // ── Failed pipelines ────────────────────────────────────────────────────────

  private async checkFailedPipelines(): Promise<void> {
    const { pipelines } = await this.pipelineRuns.getRecentRuns(48);

    // Group by pipeline name; a pipeline is only alertable if its latest run is failed
    const latestByPipeline = new Map<string, (typeof pipelines)[number]>();
    for (const run of pipelines) {
      const existing = latestByPipeline.get(run.pipelineName);
      if (!existing || run.startedAt > existing.startedAt) {
        latestByPipeline.set(run.pipelineName, run);
      }
    }

    for (const run of latestByPipeline.values()) {
      if (run.status !== 'failed') continue;

      const alreadyOpen = await this.dataAlerts.hasOpenAlert(
        'pipeline_failed',
        undefined,
        run.pipelineName,
      );
      if (alreadyOpen) continue;

      const title = `Pipeline failed: ${run.displayName}`;
      const message =
        `Pipeline "${run.pipelineName}" failed at ${run.startedAt}. ` +
        (run.errorMessage ? `Error: ${run.errorMessage}` : 'No error details available.');

      const result = await this.dataAlerts.createAlert({
        alertType: 'pipeline_failed',
        severity: 'critical',
        pipelineName: run.pipelineName,
        title,
        message,
      });

      if (result.success) {
        await this.sendCriticalAlertEmail({ title, message, sourceName: run.displayName });
      }
    }
  }

  // ── Email helper ────────────────────────────────────────────────────────────

  private async sendCriticalAlertEmail(alert: {
    title: string;
    message: string;
    sourceName: string;
  }): Promise<void> {
    const adminEmail = this.config.get<string>('ADMIN_EMAIL');
    if (!adminEmail) {
      this.logger.warn('ADMIN_EMAIL not set — skipping critical alert email');
      return;
    }

    const detectedAt = new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';

    await this.emailService.sendEmail({
      to: adminEmail,
      subject: `[PropertyIQ Alert] ${alert.title}`,
      html: `
        <p><strong>Alert:</strong> ${alert.title}</p>
        <p><strong>Source:</strong> ${alert.sourceName}</p>
        <p><strong>Details:</strong> ${alert.message}</p>
        <p><strong>Detected at:</strong> ${detectedAt}</p>
        <p>Log in to the admin panel to acknowledge this alert.</p>
      `,
      emailType: 'data_pipeline_alert',
      metadata: { alertTitle: alert.title, sourceName: alert.sourceName },
    });
  }
}
