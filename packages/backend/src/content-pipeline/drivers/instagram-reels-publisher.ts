import { Injectable } from '@nestjs/common';
import {
  PlatformPublisher,
  PublishRequest,
  PublishResult,
} from './platform-publisher.interface';
import { Platform } from '../types';
import { PlatformCredentialsService } from '../platform-credentials.service';

interface InstagramContainerCreateResponse {
  id: string;
}

interface InstagramContainerStatusResponse {
  status_code: 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'EXPIRED' | 'PUBLISHED';
}

interface InstagramPublishResponse {
  id: string;
}

const GRAPH = 'https://graph.facebook.com/v21.0';

/**
 * InstagramReelsPublisher — Graph API two-step container flow.
 *
 *   1. POST /<ig-user-id>/media        (create container; IG pulls video_url)
 *   2. Poll /<container-id> for status_code=FINISHED
 *   3. POST /<ig-user-id>/media_publish (creation_id=<container-id>)
 *
 * Unlike TikTok we do NOT push bytes — Instagram pulls the video itself,
 * so `req.videoPath` MUST be a publicly reachable HTTPS URL (a Supabase
 * signed URL works; the upstream handler is responsible for producing it).
 *
 * Draft mode: skip step 3 and return the container id. The container is
 * unpublished and IG auto-expires it after 24h. There is no "save to drafts"
 * concept on the IG Graph API — this is the closest analogue.
 *
 * On budget exhaustion we throw a typed error with `.code =
 * 'instagram_publish_timeout'` and the container_id attached so the calling
 * handler can surface it for ops alerting (P4).
 */
@Injectable()
export class InstagramReelsPublisher implements PlatformPublisher {
  readonly platform: Platform = 'instagram_reels';

  constructor(private readonly creds: PlatformCredentialsService) {}

  async isConfigured(): Promise<boolean> {
    if (!process.env.META_GRAPH_APP_ID || !process.env.META_GRAPH_APP_SECRET) {
      return false;
    }
    const row = await this.creds.getActive('instagram_reels');
    return row !== null && !!row.accountLabel;
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const { accessToken, igUserId } = await this.getCredentials();

    const caption = this.buildCaption(req.description, req.tags);

    const containerParams = new URLSearchParams({
      media_type: 'REELS',
      video_url: req.videoPath,
      caption,
      access_token: accessToken,
    });
    const containerRes = await fetch(`${GRAPH}/${igUserId}/media`, {
      method: 'POST',
      body: containerParams,
    });
    if (!containerRes.ok) {
      const text = await containerRes.text();
      throw new Error(
        `instagram container create failed: ${containerRes.status} ${text}`,
      );
    }
    const container =
      (await containerRes.json()) as InstagramContainerCreateResponse;
    const containerId = container.id;

    await this.pollUntilFinished(containerId, accessToken);

    if (req.postMode === 'draft') {
      return {
        externalId: containerId,
        externalUrl: `https://graph.facebook.com/${containerId}`,
        cost: {
          provider: 'instagram',
          amount_usd: 0,
          units: 1,
          unit_type: 'requests',
        },
        providerResponse: { container: containerId, mode: 'draft' },
      };
    }

    const publishParams = new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken,
    });
    const publishRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
      method: 'POST',
      body: publishParams,
    });
    if (!publishRes.ok) {
      const text = await publishRes.text();
      throw new Error(`instagram publish failed: ${publishRes.status} ${text}`);
    }
    const publish = (await publishRes.json()) as InstagramPublishResponse;

    return {
      externalId: publish.id,
      externalUrl: `https://www.instagram.com/reel/${publish.id}`,
      cost: {
        provider: 'instagram',
        amount_usd: 0,
        units: 1,
        unit_type: 'requests',
      },
      providerResponse: publish,
    };
  }

  private buildCaption(description: string, tags: string[]): string {
    const tagLine = tags
      .map((t) => (t.startsWith('#') ? t : `#${t}`))
      .join(' ');
    const full = tagLine ? `${description}\n\n${tagLine}` : description;
    return full.slice(0, 2200);
  }

  private async getCredentials(): Promise<{
    accessToken: string;
    igUserId: string;
  }> {
    const row = await this.creds.getActive('instagram_reels');
    if (!row) {
      throw new Error(
        'Instagram not connected. Visit /admin/content-pipeline/platforms and click Connect.',
      );
    }
    if (!row.accountLabel) {
      throw new Error(
        'Instagram credential is missing the IG user ID (stored in account_label). Reconnect the account.',
      );
    }
    return { accessToken: row.refreshToken, igUserId: row.accountLabel };
  }

  /**
   * Bounded exponential backoff polling on container status.
   *
   * Wait sequence: 5s, 7s, 10s, 14s, 20s, 28s, 30s, 30s, …  (capped at 30s).
   * Total budget: 600s (10 min). Instagram typically finishes Reels processing
   * in 30-90s; longer means we should surface a typed timeout to the operator.
   *
   * Status semantics:
   *   - IN_PROGRESS  → keep polling
   *   - FINISHED     → ready to publish (success)
   *   - ERROR        → IG could not process the video (terminal)
   *   - EXPIRED      → the source URL went away while IG was fetching (terminal)
   *   - PUBLISHED    → container has already been published (treated as success)
   */
  private async pollUntilFinished(
    containerId: string,
    accessToken: string,
  ): Promise<void> {
    const budgetMs = 600_000;
    const start = Date.now();
    let waitMs = 5_000;

    while (Date.now() - start < budgetMs) {
      await new Promise((r) => setTimeout(r, waitMs));
      waitMs = Math.min(Math.round(waitMs * 1.4), 30_000);

      const params = new URLSearchParams({
        fields: 'status_code',
        access_token: accessToken,
      });
      const res = await fetch(`${GRAPH}/${containerId}?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`instagram status poll failed: ${res.status} ${text}`);
      }
      const json = (await res.json()) as InstagramContainerStatusResponse;

      if (json.status_code === 'FINISHED' || json.status_code === 'PUBLISHED') {
        return;
      }
      if (json.status_code === 'ERROR' || json.status_code === 'EXPIRED') {
        throw new Error(
          `instagram container terminal status: ${json.status_code} (container_id=${containerId})`,
        );
      }
      // IN_PROGRESS — keep polling.
    }

    const err = new Error(
      `instagram publish timeout after ${budgetMs}ms (container_id=${containerId})`,
    );
    (err as Error & { code: string; containerId: string }).code =
      'instagram_publish_timeout';
    (err as Error & { code: string; containerId: string }).containerId =
      containerId;
    throw err;
  }
}
