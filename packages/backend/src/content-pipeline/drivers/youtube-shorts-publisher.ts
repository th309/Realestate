import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { createReadStream } from 'fs';
import {
  PlatformPublisher,
  PublishRequest,
  PublishResult,
} from './platform-publisher.interface';
import { Platform } from '../types';

@Injectable()
export class YouTubeShortsPublisher implements PlatformPublisher {
  readonly platform: Platform = 'youtube_shorts';
  private oauth2: any;

  isConfigured(): boolean {
    return !!(
      process.env.YOUTUBE_OAUTH_CLIENT_ID &&
      process.env.YOUTUBE_OAUTH_CLIENT_SECRET &&
      process.env.YOUTUBE_OAUTH_REFRESH_TOKEN
    );
  }

  private getAuth() {
    if (!this.oauth2) {
      this.oauth2 = new google.auth.OAuth2(
        process.env.YOUTUBE_OAUTH_CLIENT_ID,
        process.env.YOUTUBE_OAUTH_CLIENT_SECRET,
      );
      this.oauth2.setCredentials({
        refresh_token: process.env.YOUTUBE_OAUTH_REFRESH_TOKEN,
      });
    }
    return this.oauth2;
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    if (!this.isConfigured())
      throw new Error('YouTubeShortsPublisher not configured');

    const yt = google.youtube({ version: 'v3', auth: this.getAuth() });
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
    await this.getAuth().getAccessToken();
  }
}
