import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../email/email.service';

export type AlertSeverity = 'info' | 'warn' | 'error';

@Injectable()
export class AlertDispatcherService {
  private readonly logger = new Logger(AlertDispatcherService.name);

  constructor(private readonly email: EmailService) {}

  async sendAlert(
    severity: AlertSeverity,
    key: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await Promise.allSettled([
      this.sendSlack(severity, key, message, details),
      this.sendEmail(severity, key, message, details),
    ]);
  }

  private async sendSlack(
    severity: AlertSeverity,
    key: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const webhook = process.env.SLACK_WEBHOOK_URL;
    if (!webhook) return;

    const payload = {
      text: `*PropertyIQ Content Pipeline* (${severity}) — \`${key}\`\n${message}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*PropertyIQ Content Pipeline* (${severity}) — \`${key}\`\n${message}`,
          },
        },
        ...(details
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `\`\`\`${JSON.stringify(details, null, 2).slice(0, 2800)}\`\`\``,
                },
              },
            ]
          : []),
      ],
    };

    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(
          `Slack webhook failed: ${res.status} ${text.slice(0, 200)}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Slack webhook error: ${(err as Error).message}`);
    }
  }

  private async sendEmail(
    severity: AlertSeverity,
    key: string,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const to = process.env.ADMIN_EMAIL;
    if (!to) return;

    const subject = `[Content Pipeline] ${severity.toUpperCase()} ${key}`;
    const html = [
      `<p><strong>Severity:</strong> ${severity}</p>`,
      `<p><strong>Key:</strong> ${key}</p>`,
      `<p><strong>Message:</strong></p>`,
      `<pre style="white-space:pre-wrap">${escapeHtml(message)}</pre>`,
      details
        ? `<p><strong>Details:</strong></p><pre style="white-space:pre-wrap">${escapeHtml(
            JSON.stringify(details, null, 2),
          )}</pre>`
        : '',
    ].join('\n');

    await this.email.sendEmail({
      to,
      subject,
      html,
      emailType: 'content_pipeline_alert',
      metadata: { severity, key },
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

