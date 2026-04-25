import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import {
  PlatformPublisher,
  PublishRequest,
  PublishResult,
} from './platform-publisher.interface';
import { Platform } from '../types';
import { PlatformCredentialsService } from '../platform-credentials.service';

interface LinkedInRegisterUploadResponse {
  value: {
    uploadMechanism: {
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
        uploadUrl: string;
      };
    };
    asset: string;
  };
}

interface LinkedInUgcPostResponse {
  id: string;
}

const LI = 'https://api.linkedin.com/v2';
const RESTLI = '2.0.0';

/**
 * LinkedInPublisher — UGC Posts API v2 video publishing.
 *
 *   1. POST /v2/assets?action=registerUpload
 *      → returns { uploadMechanism.uploadUrl, asset }
 *   2. PUT  <uploadUrl> with the video buffer
 *      (Authorization: Bearer <token>, Content-Type: application/octet-stream)
 *   3. POST /v2/ugcPosts referencing the asset URN
 *      → returns { id: 'urn:li:share:...' }
 *
 * No status polling — all three calls are synchronous on LinkedIn's side.
 *
 * Draft mode: real `lifecycleState='DRAFT'` (not a visibility hack). The post
 * lives in the user's draft list and does NOT surface in feeds. Visibility
 * stays PUBLIC for both modes; gating is purely lifecycle-based.
 *
 * The URN URL pattern resolves the same for DRAFT and PUBLISHED — the URL is
 * just inactive (404 to non-authors) until lifecycleState flips to PUBLISHED.
 */
@Injectable()
export class LinkedInPublisher implements PlatformPublisher {
  readonly platform: Platform = 'linkedin';

  constructor(private readonly creds: PlatformCredentialsService) {}

  async isConfigured(): Promise<boolean> {
    if (
      !process.env.LINKEDIN_OAUTH_CLIENT_ID ||
      !process.env.LINKEDIN_OAUTH_CLIENT_SECRET
    ) {
      return false;
    }
    const row = await this.creds.getActive('linkedin');
    return row !== null && !!row.accountLabel;
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    const { accessToken, ownerUrn } = await this.getCredentials();
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': RESTLI,
      'Content-Type': 'application/json',
    };

    const registerRes = await fetch(`${LI}/assets?action=registerUpload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-video'],
          owner: ownerUrn,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent',
            },
          ],
        },
      }),
    });
    if (!registerRes.ok) {
      const text = await registerRes.text();
      throw new Error(
        `linkedin registerUpload failed: ${registerRes.status} ${text}`,
      );
    }
    const register =
      (await registerRes.json()) as LinkedInRegisterUploadResponse;
    const uploadUrl =
      register.value.uploadMechanism[
        'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
      ].uploadUrl;
    const assetUrn = register.value.asset;

    const videoBuffer = readFileSync(req.videoPath);
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: videoBuffer,
    });
    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`linkedin upload failed: ${uploadRes.status} ${text}`);
    }

    const lifecycleState = req.postMode === 'draft' ? 'DRAFT' : 'PUBLISHED';
    const shareCommentary = this.buildCommentary(req.description, req.tags);

    const postRes = await fetch(`${LI}/ugcPosts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        author: ownerUrn,
        lifecycleState,
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: shareCommentary },
            shareMediaCategory: 'VIDEO',
            media: [
              {
                status: 'READY',
                description: { text: req.title },
                media: assetUrn,
                title: { text: req.title },
              },
            ],
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });
    if (!postRes.ok) {
      const text = await postRes.text();
      throw new Error(`linkedin ugcPosts failed: ${postRes.status} ${text}`);
    }
    const post = (await postRes.json()) as LinkedInUgcPostResponse;

    return {
      externalId: post.id,
      externalUrl: `https://www.linkedin.com/feed/update/${encodeURIComponent(post.id)}/`,
      cost: {
        provider: 'linkedin',
        amount_usd: 0,
        units: 1,
        unit_type: 'requests',
      },
      providerResponse: { ...post, asset: assetUrn, lifecycleState },
    };
  }

  private buildCommentary(description: string, tags: string[]): string {
    const tagLine = tags
      .map((t) => (t.startsWith('#') ? t : `#${t}`))
      .join(' ');
    const full = tagLine ? `${description}\n\n${tagLine}` : description;
    return full.slice(0, 3000);
  }

  private async getCredentials(): Promise<{
    accessToken: string;
    ownerUrn: string;
  }> {
    const row = await this.creds.getActive('linkedin');
    if (!row) {
      throw new Error(
        'LinkedIn not connected. Visit /admin/content-pipeline/platforms and click Connect.',
      );
    }
    if (!row.accountLabel) {
      throw new Error(
        'LinkedIn credential is missing the organization URN (stored in account_label). Reconnect the page.',
      );
    }
    return { accessToken: row.refreshToken, ownerUrn: row.accountLabel };
  }
}
