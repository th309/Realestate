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
/** Bounds concurrent outbound requests to the push provider per sendToUser() call. */
const SEND_CHUNK_SIZE = 5;

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

    // Chunked, not Promise.all(subs.map(...)) — bounds concurrent outbound
    // requests to the push provider regardless of how many subscriptions a
    // user has (the per-user row count is separately capped at write time
    // in PushSubscriptionsDataService, but this keeps sendToUser() safe on
    // its own).
    for (let i = 0; i < subs.length; i += SEND_CHUNK_SIZE) {
      const chunk = subs.slice(i, i + SEND_CHUNK_SIZE);
      await Promise.all(
        chunk.map((sub) => this.sendToSubscription(sub, body, result)),
      );
    }

    return result;
  }

  private async sendToSubscription(
    sub: { id: string; endpoint: string; p256dh: string; auth: string },
    body: string,
    result: PushSendResult,
  ): Promise<void> {
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
        // Non-404/410 failures (provider 5xx, timeout, network error) are
        // counted but NOT pruned — a transient failure shouldn't delete a
        // still-valid subscription. Follow-up ticket: a failure-count column
        // + last_success_at-age cleanup for subscriptions that never
        // recover; skipped here as a schema change, not a "cheap, do now" fix.
        result.failed++;
        this.logger.warn(
          `Push send failed for ${endpointSuffix(sub.endpoint)}: status=${statusCode ?? 'unknown'}`,
        );
      }
    }
  }
}
