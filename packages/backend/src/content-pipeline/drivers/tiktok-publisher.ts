import { Injectable } from '@nestjs/common';
import { createReadStream, statSync } from 'fs';
import {
  PlatformPublisher,
  PublishRequest,
  PublishResult,
} from './platform-publisher.interface';
import { Platform } from '../types';
import { PlatformCredentialsService } from '../platform-credentials.service';

interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface TikTokInitResponse {
  data: {
    publish_id: string;
    upload_url: string;
  };
}

interface TikTokStatusResponse {
  data: {
    status: string;
    publicaly_available_post_id?: string[];
    fail_reason?: string;
  };
}

const TIKTOK_API_BASE = 'https://open.tiktokapis.com';

/**
 * TikTokPublisher — two-step Content Posting API flow.
 *
 *   1. POST /v2/post/publish/video/init/  (returns publish_id + upload_url)
 *   2. PUT  upload_url with the video binary (multipart-style chunk header)
 *   3. Poll /v2/post/publish/status/fetch/ until PUBLISH_COMPLETE / SEND_TO_USER_INBOX
 *      or terminal failure. Bounded backoff: 5s → 30s, total budget 600s.
 *
 * On budget exhaustion we throw a typed error with `.code = 'tiktok_publish_timeout'`
 * and the publish_id attached so the calling handler can surface it for ops.
 *
 * post_mode mapping:
 *   - 'direct'    → DIRECT_POST    (publish immediately, public)
 *   - 'draft'     → MEDIA_UPLOAD   (lands in user's TikTok inbox/drafts)
 *   - 'scheduled' → MEDIA_UPLOAD   (TikTok API has no native scheduling — drafts only)
 */
@Injectable()
export class TikTokPublisher implements PlatformPublisher {
  readonly platform: Platform = 'tiktok';

  constructor(private readonly creds: PlatformCredentialsService) {}

  async isConfigured(): Promise<boolean> {
    if (
      !process.env.TIKTOK_OAUTH_CLIENT_KEY ||
      !process.env.TIKTOK_OAUTH_CLIENT_SECRET ||
      !process.env.TIKTOK_OAUTH_REDIRECT_URI
    ) {
      return false;
    }
    return (await this.creds.getActive('tiktok')) !== null;
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const accessToken = await this.getAccessToken();

    const videoSize = statSync(req.videoPath).size;
    const postMode = req.postMode === 'direct' ? 'DIRECT_POST' : 'MEDIA_UPLOAD';

    const caption = this.buildCaption(req.description, req.tags);

    const initRes = await fetch(
      `${TIKTOK_API_BASE}/v2/post/publish/video/init/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          post_info: {
            title: caption.slice(0, 2200),
            privacy_level:
              postMode === 'DIRECT_POST' ? 'PUBLIC_TO_EVERYONE' : 'SELF_ONLY',
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 1000,
            post_mode: postMode,
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: videoSize,
            chunk_size: videoSize,
            total_chunk_count: 1,
          },
        }),
      },
    );
    if (!initRes.ok) {
      const text = await initRes.text();
      throw new Error(`tiktok init failed: ${initRes.status} ${text}`);
    }
    const init = (await initRes.json()) as TikTokInitResponse;
    const publishId = init.data.publish_id;
    const uploadUrl = init.data.upload_url;

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
        'Content-Length': String(videoSize),
      },
      body: createReadStream(req.videoPath) as unknown as BodyInit,
      // @ts-expect-error — undici-specific, required for streaming a Node ReadStream as body
      duplex: 'half',
    });
    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`tiktok upload failed: ${uploadRes.status} ${text}`);
    }

    const finalStatus = await this.pollUntilTerminal(accessToken, publishId);

    const externalId =
      finalStatus.data.publicaly_available_post_id?.[0] ?? publishId;
    const externalUrl =
      postMode === 'DIRECT_POST'
        ? `https://www.tiktok.com/video/${externalId}`
        : `https://www.tiktok.com/@me/video/${externalId}`;

    return {
      externalId,
      externalUrl,
      cost: {
        provider: 'tiktok',
        amount_usd: 0,
        units: 1,
        unit_type: 'requests',
      },
      providerResponse: finalStatus,
    };
  }

  private buildCaption(description: string, tags: string[]): string {
    const tagLine = tags
      .map((t) => (t.startsWith('#') ? t : `#${t}`))
      .join(' ');
    return tagLine ? `${description}\n\n${tagLine}` : description;
  }

  private async getAccessToken(): Promise<string> {
    const row = await this.creds.getActive('tiktok');
    if (!row) {
      throw new Error(
        'TikTok not connected. Visit /admin/content-pipeline/platforms and click Connect.',
      );
    }
    const res = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_OAUTH_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_OAUTH_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: row.refreshToken,
      }).toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`tiktok token refresh failed: ${res.status} ${text}`);
    }
    const json = (await res.json()) as TikTokTokenResponse;
    return json.access_token;
  }

  /**
   * Bounded exponential backoff polling.
   *
   * Wait sequence: 5s, 7s, 10s, 14s, 20s, 28s, 30s, 30s, …  (capped at 30s).
   * Total budget: 600s (10 min). TikTok's docs say "complete within minutes"
   * for normal uploads; longer means something is wrong on their side and
   * we should surface a typed timeout to the operator.
   */
  private async pollUntilTerminal(
    accessToken: string,
    publishId: string,
  ): Promise<TikTokStatusResponse> {
    const budgetMs = 600_000;
    const start = Date.now();
    let waitMs = 5_000;

    while (Date.now() - start < budgetMs) {
      await new Promise((r) => setTimeout(r, waitMs));
      waitMs = Math.min(Math.round(waitMs * 1.4), 30_000);

      const res = await fetch(
        `${TIKTOK_API_BASE}/v2/post/publish/status/fetch/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({ publish_id: publishId }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`tiktok status poll failed: ${res.status} ${text}`);
      }
      const json = (await res.json()) as TikTokStatusResponse;
      const status = json.data.status;

      if (status === 'PUBLISH_COMPLETE' || status === 'SEND_TO_USER_INBOX') {
        return json;
      }
      if (status === 'FAILED') {
        throw new Error(
          `tiktok publish FAILED: ${json.data.fail_reason ?? 'unknown'}`,
        );
      }
      // PROCESSING_UPLOAD / PROCESSING_PUBLISH — keep polling.
    }

    const err = new Error(
      `tiktok publish timeout after ${budgetMs}ms (publish_id=${publishId})`,
    );
    (err as any).code = 'tiktok_publish_timeout';
    (err as any).publishId = publishId;
    throw err;
  }

  async refreshCredentials(): Promise<void> {
    await this.getAccessToken();
  }
}
