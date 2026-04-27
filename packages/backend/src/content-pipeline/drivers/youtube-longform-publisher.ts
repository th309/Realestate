import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createReadStream } from 'fs';
import {
  PlatformPublisher,
  PublishRequest,
  PublishResult,
} from './platform-publisher.interface';
import { Platform } from '../types';
import { PlatformCredentialsService } from '../platform-credentials.service';

/**
 * Standard YouTube uploads (16:9 long-form). Uses the **same OAuth connection**
 * as Shorts (`youtube_shorts` credential row): one Google channel for both.
 */
@Injectable()
export class YouTubeLongFormPublisher implements PlatformPublisher {
  readonly platform: Platform = 'youtube_long';
  private cachedAuth: { refreshToken: string; client: OAuth2Client } | null =
    null;

  constructor(private readonly creds: PlatformCredentialsService) {}

  /** Long-form uploads reuse the Shorts-connected channel until a separate OAuth exists. */
  async isConfigured(): Promise<boolean> {
    return (await this.creds.getActive('youtube_shorts')) !== null;
  }

  private async getAuth(): Promise<OAuth2Client> {
    const row = await this.creds.getActive('youtube_shorts');
    if (!row) {
      throw new Error(
        'YouTube not connected. Visit /admin/content-pipeline/platforms and connect YouTube Shorts (same channel is used for long-form).',
      );
    }
    if (!this.cachedAuth || this.cachedAuth.refreshToken !== row.refreshToken) {
      const client = new google.auth.OAuth2(
        process.env.YOUTUBE_OAUTH_CLIENT_ID,
        process.env.YOUTUBE_OAUTH_CLIENT_SECRET,
      );
      client.setCredentials({ refresh_token: row.refreshToken });
      this.cachedAuth = { refreshToken: row.refreshToken, client };
    }
    return this.cachedAuth.client;
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const auth = await this.getAuth();
    const yt = google.youtube({ version: 'v3', auth });
    const privacyStatus = req.postMode === 'direct' ? 'public' : 'private';

    const response = await yt.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: req.title.substring(0, 100),
          description: req.description.substring(0, 5000),
          tags: req.tags.slice(0, 40),
          categoryId: '22',
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
          publishAt: req.scheduledFor?.toISOString(),
        },
      },
      media: { body: createReadStream(req.videoPath) },
    });

    const videoId = (response.data as { id?: string }).id;
    if (!videoId) throw new Error('YouTube long-form upload returned no video id');

    if (req.captionsSrtPath) {
      await yt.captions.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            videoId,
            language: 'en',
            name: 'English',
            isDraft: false,
          },
        },
        media: {
          mimeType: 'application/octet-stream',
          body: createReadStream(req.captionsSrtPath),
        },
      });
    }

    return {
      externalId: videoId,
      externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      cost: {
        provider: 'youtube',
        amount_usd: 0,
        units: 1,
        unit_type: 'requests',
      },
      providerResponse: response.data,
    };
  }
}
