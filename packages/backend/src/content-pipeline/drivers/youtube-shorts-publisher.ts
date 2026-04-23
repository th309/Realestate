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

@Injectable()
export class YouTubeShortsPublisher implements PlatformPublisher {
  readonly platform: Platform = 'youtube_shorts';
  private cachedAuth: { refreshToken: string; client: OAuth2Client } | null =
    null;

  constructor(private readonly creds: PlatformCredentialsService) {}

  async isConfigured(): Promise<boolean> {
    return (await this.creds.getActive('youtube_shorts')) !== null;
  }

  private async getAuth(): Promise<OAuth2Client> {
    const row = await this.creds.getActive('youtube_shorts');
    if (!row) {
      throw new Error(
        'YouTube not connected. Visit /admin/content-pipeline/platforms and click Connect.',
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

    const descriptionWithHashtag = req.description.includes('#Shorts')
      ? req.description
      : req.description + '\n\n#Shorts';

    const response = await yt.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: req.title,
          description: descriptionWithHashtag,
          tags: req.tags,
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

    const videoId = (response.data as any).id;
    return {
      externalId: videoId,
      externalUrl: `https://youtube.com/shorts/${videoId}`,
      cost: {
        provider: 'youtube',
        amount_usd: 0,
        units: 1,
        unit_type: 'requests',
      },
      providerResponse: response.data,
    };
  }

  async refreshCredentials(): Promise<void> {
    const auth = await this.getAuth();
    await auth.getAccessToken();
  }
}
