/**
 * Push Service
 *
 * Sends Web Push notifications via VAPID. Fail-fast on missing VAPID secrets
 * per CLAUDE.md §1.2 (mirrors AnthropicService's constructor pattern) — this
 * service must never silently degrade like EmailService does without a key.
 *
 * Callers (AlertProcessorService, ThresholdAlertService) MUST wrap
 * sendToUser() in try/catch: a push failure must never break alert
 * processing.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush, { WebPushError } from 'web-push';
import { PushSubscriptionsDataService } from './push-subscriptions.data';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  badgeCount?: number;
}

export interface PushSendResult {
  sent: number;
  failed: number;
  pruned: number;
}

const PUSH_TTL_SECONDS = 24 * 60 * 60; // 24h

/** Last-8-chars suffix for log lines — never log a full endpoint or any key. */
function endpointSuffix(endpoint: string): string {
  return `...${endpoint.slice(-8)}`;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly subscriptions: PushSubscriptionsDataService,
  ) {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT');

    // App MUST crash if a secret is missing per CLAUDE.md Section 1.2.
    if (!publicKey) throw new Error('VAPID_PUBLIC_KEY is required');
    if (!privateKey) throw new Error('VAPID_PRIVATE_KEY is required');
    if (!subject) throw new Error('VAPID_SUBJECT is required');

    webpush.setVapidDetails(subject, publicKey, privateKey);
  }

  /**
   * Send a notification to every subscription registered for a user (a user
   * may have several devices/browsers). Dead subscriptions (404/410 from the
   * push service) are pruned automatically. Never throws — a send failure on
   * one or all subscriptions is reported in the returned counts, not via
   * exception, so callers on the alert-processing path can't be broken by it.
   */
  async sendToUser(
    userId: string,
    payload: PushPayload,
  ): Promise<PushSendResult> {
    const result: PushSendResult = { sent: 0, failed: 0, pruned: 0 };

    let subs;
    try {
      subs = await this.subscriptions.findByUserId(userId);
    } catch (err) {
      this.logger.error(
        `Failed to load push subscriptions for user: ${err instanceof Error ? err.message : err}`,
      );
      return result;
    }

    if (!subs.length) return result;

    const body = JSON.stringify(payload);

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
            { TTL: PUSH_TTL_SECONDS },
          );
          result.sent++;
          await this.subscriptions.markSuccess(sub.id);
        } catch (err) {
          const statusCode =
            err instanceof WebPushError ? err.statusCode : undefined;
          if (statusCode === 404 || statusCode === 410) {
            result.pruned++;
            await this.subscriptions.removeById(sub.id);
            this.logger.log(
              `Pruned dead push subscription ${endpointSuffix(sub.endpoint)}`,
            );
          } else {
            result.failed++;
            this.logger.warn(
              `Push send failed for ${endpointSuffix(sub.endpoint)}: status=${statusCode ?? 'unknown'}`,
            );
          }
        }
      }),
    );

    return result;
  }
}
