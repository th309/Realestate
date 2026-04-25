import { Injectable } from '@nestjs/common';
import { createReadStream, statSync } from 'fs';
import {
  PlatformPublisher,
  PublishRequest,
  PublishResult,
} from './platform-publisher.interface';
import { Platform } from '../types';
import { PlatformCredentialsService } from '../platform-credentials.service';

interface FacebookStartResponse {
  video_id: string;
  upload_url: string;
}

interface FacebookFinishResponse {
  success: boolean;
  post_id?: string;
}

interface FacebookVideoStatusResponse {
  status?: {
    video_status?: 'ready' | 'processing' | 'error' | 'expired';
    uploading_phase?: { status: string };
    processing_phase?: { status: string };
    publishing_phase?: { status: string };
  };
}

const GRAPH = 'https://graph.facebook.com/v21.0';

/**
 * FacebookReelsPublisher — Resumable Upload API for Reels (Graph v21.0).
 *
 *   1. START    POST /<page-id>/video_reels?upload_phase=start
 *               → returns { video_id, upload_url }
 *   2. TRANSFER POST <upload_url> with binary body
 *               (headers: Authorization: OAuth <token>, offset: 0, file_size: N)
 *   3. FINISH   POST /<page-id>/video_reels?upload_phase=finish&video_id=...&video_state=PUBLISHED|DRAFT
 *   4. POLL     GET  /<video-id>?fields=status until status.video_status in {ready, error, expired}.
 *
 * Bounded backoff: 5s → 30s, total budget 600s. On exhaustion we throw a typed
 * error with `.code = 'facebook_publish_timeout'` and `.videoId` attached so the
 * caller can surface it for ops alerting (P4).
 *
 * Draft mode: `video_state=DRAFT` — saves the reel as a Page draft. There is
 * no public URL for a draft, so we return the Graph admin endpoint as the
 * externalUrl (mirrors the InstagramReelsPublisher draft pattern).
 */
@Injectable()
export class FacebookReelsPublisher implements PlatformPublisher {
  readonly platform: Platform = 'facebook_reels';

  constructor(private readonly creds: PlatformCredentialsService) {}

  async isConfigured(): Promise<boolean> {
    if (!process.env.META_GRAPH_APP_ID || !process.env.META_GRAPH_APP_SECRET) {
      return false;
    }
    const row = await this.creds.getActive('facebook_reels');
    return row !== null && !!row.accountLabel;
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const { accessToken, pageId } = await this.getCredentials();
    const fileSize = statSync(req.videoPath).size;
    const description = this.buildDescription(req.description, req.tags);
    const videoState = req.postMode === 'direct' ? 'PUBLISHED' : 'DRAFT';

    const startParams = new URLSearchParams({
      upload_phase: 'start',
      access_token: accessToken,
    });
    const startRes = await fetch(
      `${GRAPH}/${pageId}/video_reels?${startParams.toString()}`,
      { method: 'POST' },
    );
    if (!startRes.ok) {
      const text = await startRes.text();
      throw new Error(`facebook start failed: ${startRes.status} ${text}`);
    }
    const start = (await startRes.json()) as FacebookStartResponse;

    const uploadRes = await fetch(start.upload_url, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${accessToken}`,
        offset: '0',
        file_size: String(fileSize),
      },
      body: createReadStream(req.videoPath) as unknown as BodyInit,
      // @ts-expect-error — undici-specific, required for streaming a Node ReadStream as body
      duplex: 'half',
    });
    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`facebook upload failed: ${uploadRes.status} ${text}`);
    }

    const finishParams = new URLSearchParams({
      upload_phase: 'finish',
      video_id: start.video_id,
      video_state: videoState,
      description: description.slice(0, 2200),
      access_token: accessToken,
    });
    const finishRes = await fetch(
      `${GRAPH}/${pageId}/video_reels?${finishParams.toString()}`,
      { method: 'POST' },
    );
    if (!finishRes.ok) {
      const text = await finishRes.text();
      throw new Error(`facebook finish failed: ${finishRes.status} ${text}`);
    }
    const finish = (await finishRes.json()) as FacebookFinishResponse;

    await this.pollUntilReady(start.video_id, accessToken);

    const externalId = finish.post_id ?? start.video_id;
    const externalUrl =
      videoState === 'DRAFT'
        ? `https://graph.facebook.com/${start.video_id}`
        : `https://www.facebook.com/reel/${externalId}`;

    return {
      externalId,
      externalUrl,
      cost: {
        provider: 'facebook',
        amount_usd: 0,
        units: 1,
        unit_type: 'requests',
      },
      providerResponse: { ...finish, video_id: start.video_id },
    };
  }

  private buildDescription(description: string, tags: string[]): string {
    const tagLine = tags
      .map((t) => (t.startsWith('#') ? t : `#${t}`))
      .join(' ');
    return tagLine ? `${description}\n\n${tagLine}` : description;
  }

  private async getCredentials(): Promise<{
    accessToken: string;
    pageId: string;
  }> {
    const row = await this.creds.getActive('facebook_reels');
    if (!row) {
      throw new Error(
        'Facebook not connected. Visit /admin/content-pipeline/platforms and click Connect.',
      );
    }
    if (!row.accountLabel) {
      throw new Error(
        'Facebook credential is missing the Page ID (stored in account_label). Reconnect the page.',
      );
    }
    return { accessToken: row.refreshToken, pageId: row.accountLabel };
  }

  /**
   * Bounded exponential backoff polling on video processing status.
   *
   * Wait sequence: 5s, 7s, 10s, 14s, 20s, 28s, 30s, 30s, … (capped at 30s).
   * Total budget: 600s (10 min). FB usually finishes processing in < 60s for
   * a 60s reel; longer means something is wrong and we should surface a typed
   * timeout to the operator.
   *
   * video_status semantics:
   *   - processing → keep polling
   *   - ready      → terminal success
   *   - error      → terminal failure (we throw)
   *   - expired    → upload session expired before finish (terminal failure)
   */
  private async pollUntilReady(
    videoId: string,
    accessToken: string,
  ): Promise<void> {
    const budgetMs = 600_000;
    const start = Date.now();
    let waitMs = 5_000;

    while (Date.now() - start < budgetMs) {
      await new Promise((r) => setTimeout(r, waitMs));
      waitMs = Math.min(Math.round(waitMs * 1.4), 30_000);

      const params = new URLSearchParams({
        fields: 'status',
        access_token: accessToken,
      });
      const res = await fetch(`${GRAPH}/${videoId}?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`facebook status poll failed: ${res.status} ${text}`);
      }
      const json = (await res.json()) as FacebookVideoStatusResponse;
      const status = json.status?.video_status;

      if (status === 'ready') return;
      if (status === 'error' || status === 'expired') {
        throw new Error(
          `facebook video terminal status: ${status} (video_id=${videoId})`,
        );
      }
      // processing or undefined — keep polling.
    }

    const err = new Error(
      `facebook publish timeout after ${budgetMs}ms (video_id=${videoId})`,
    );
    (err as Error & { code: string; videoId: string }).code =
      'facebook_publish_timeout';
    (err as Error & { code: string; videoId: string }).videoId = videoId;
    throw err;
  }
}
