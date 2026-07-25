import { Injectable, Logger } from '@nestjs/common';
import {
  LATE_API_BASE_URL_DEFAULT,
  LateApiError,
  LateNotConfiguredError,
  type LateAccount,
  type LateConnectResponse,
  type LateProfile,
  type LatePublishParams,
  type LatePublishResult,
} from './late-client.types';

/**
 * Late (getlate.dev, also branded Zernio) API client.
 *
 * Late is a social-media aggregator that OWNS the platform developer apps
 * (Meta / TikTok / LinkedIn / X), so PropertyIQ never registers its own
 * platform apps. A user clicks Connect, Late hosts the OAuth screen, and the
 * account comes back connected — a Munch-Studio-style one-click flow.
 *
 * Endpoints implemented here are grounded in Late's official API reference
 * (https://docs.getlate.dev → docs.zernio.com), verified 2026-07-22:
 *   - GET  /profiles                    list workspaces/brands
 *   - POST /profiles                    create a workspace/brand
 *   - GET  /connect/{platform}          start hosted OAuth → { authUrl, state }
 *   - GET  /accounts                    list connected social accounts
 *   - DELETE /accounts/{id}             disconnect an account
 *   - POST /posts                       publish/schedule a post
 *   - GET  /analytics                   post/account analytics
 *
 * Stateless: reads LATE_API_KEY at call time (never at boot) so the feature
 * stays optional until Troy provisions the account. When the key is absent
 * every method throws {@link LateNotConfiguredError}; callers turn that into a
 * structured 503 rather than crashing the app.
 */
interface LateRequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Extra request headers (e.g. `x-request-id` for idempotent publishing). */
  headers?: Record<string, string>;
}

@Injectable()
export class LateClientService {
  private readonly logger = new Logger(LateClientService.name);

  /** True when LATE_API_KEY is present. Read at call time, never cached. */
  isConfigured(): boolean {
    return !!process.env.LATE_API_KEY?.trim();
  }

  private baseUrl(): string {
    return (
      process.env.LATE_API_BASE_URL?.trim().replace(/\/$/, '') ||
      LATE_API_BASE_URL_DEFAULT
    );
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE' | 'PUT',
    path: string,
    opts: LateRequestOptions = {},
  ): Promise<T> {
    const apiKey = process.env.LATE_API_KEY?.trim();
    if (!apiKey) {
      // Never fall back to a hardcoded key (CLAUDE.md §1.2). Gate at call time.
      throw new LateNotConfiguredError();
    }

    const url = new URL(`${this.baseUrl()}${path}`);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) url.searchParams.append(k, String(v));
      }
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers,
      },
      ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.warn(
        `Late ${method} ${path} → ${res.status} ${detail.slice(0, 200)}`,
      );
      throw new LateApiError(
        res.status,
        `Late API ${method} ${path} failed: ${res.status}`,
        detail,
      );
    }

    // Some endpoints (e.g. DELETE) may return an empty body.
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  // ── Profiles (Late's workspace/brand entity) ──────────────────────────────

  async listProfiles(name?: string): Promise<LateProfile[]> {
    const res = await this.request<{ profiles?: LateProfile[] }>(
      'GET',
      '/profiles',
      { query: { name } },
    );
    return res.profiles ?? [];
  }

  async createProfile(name: string): Promise<LateProfile> {
    const res = await this.request<{ profile?: LateProfile } & LateProfile>(
      'POST',
      '/profiles',
      { body: { name } },
    );
    // Late may return the profile at the top level or under `profile`.
    return res.profile ?? (res as LateProfile);
  }

  /**
   * Resolve a Late profile to connect accounts under. Prefers an exact
   * name match, then the default profile, then creates one. A Late profile
   * maps 1:1 to a PropertyIQ brand.
   */
  async getOrCreateProfile(name: string): Promise<LateProfile> {
    const byName = await this.listProfiles(name);
    const exact = byName.find((p) => p.name === name);
    if (exact) return exact;

    const all = await this.listProfiles();
    const fallback =
      all.find((p) => p.name === name) ?? all.find((p) => p.isDefault);
    if (fallback) return fallback;

    return this.createProfile(name);
  }

  // ── Connect (hosted OAuth) ────────────────────────────────────────────────

  /**
   * Start the hosted OAuth flow for a platform. Returns the authorization URL
   * the user opens (popup). Late hosts the whole flow — including Facebook
   * Page / LinkedIn Organization selection — then redirects to `redirectUrl`.
   */
  async startConnect(params: {
    platform: string;
    profileId: string;
    redirectUrl: string;
  }): Promise<LateConnectResponse> {
    return this.request<LateConnectResponse>(
      'GET',
      `/connect/${params.platform}`,
      {
        query: {
          profileId: params.profileId,
          redirect_url: params.redirectUrl,
        },
      },
    );
  }

  // ── Accounts ──────────────────────────────────────────────────────────────

  async listAccounts(
    filter: { profileId?: string; platform?: string } = {},
  ): Promise<LateAccount[]> {
    const res = await this.request<{ accounts?: LateAccount[] }>(
      'GET',
      '/accounts',
      { query: { profileId: filter.profileId, platform: filter.platform } },
    );
    return res.accounts ?? [];
  }

  async disconnectAccount(accountId: string): Promise<void> {
    await this.request<unknown>('DELETE', `/accounts/${accountId}`);
  }

  // ── Publish (used by a later phase) ───────────────────────────────────────

  /**
   * Publish or schedule a post through Late. Grounded in POST /v1/posts.
   *
   * ASSUMPTION (docs did not pin the exact media field name): media is sent as
   * `mediaItems: [{ type, url }]`. Verify against the live API once the account
   * exists; the shape is isolated here so it is a one-line change.
   */
  async publishPost(params: LatePublishParams): Promise<LatePublishResult> {
    const body: Record<string, unknown> = {
      content: params.copy,
      platforms: [{ platform: params.platform, accountId: params.accountId }],
    };
    if (params.mediaUrls?.length) {
      // Phase 5 scope: feed posts carry IMAGES only (video publishes via the
      // video pipeline, Decision 2), so every media item is type:'image'. Before
      // any video URL can route here, mediaUrls must become a typed
      // { url, type } union so this mapping stops mislabeling videos as images.
      body.mediaItems = params.mediaUrls.map((url) => ({ type: 'image', url }));
    }
    if (params.scheduledAt) {
      body.scheduledFor = params.scheduledAt;
      body.timezone = params.timezone ?? 'UTC';
    } else {
      body.publishNow = true;
    }

    const headers = params.idempotencyKey
      ? { 'x-request-id': params.idempotencyKey }
      : undefined;

    try {
      const raw = await this.request<Record<string, unknown>>(
        'POST',
        '/posts',
        { body, headers },
      );
      return {
        postId: (raw._id as string) ?? (raw.postId as string) ?? undefined,
        platformPostUrl: (raw.platformPostUrl as string) ?? undefined,
        raw,
      };
    } catch (err) {
      // Late dedupes by content hash for 24h; a retried publish (e.g. after a
      // crash mid-flight) returns 409 with the existing post id. Only a body
      // that actually CONFIRMS that dedupe (carries existingPostId) is treated
      // as success. Any other 409 — rate limit, account-state conflict, or a
      // malformed body — rethrows, so we never mistake it for "already posted"
      // and silently drop the post.
      if (err instanceof LateApiError && err.status === 409) {
        const dup = this.parseDuplicate(err.body);
        if (dup.existingPostId) {
          return { postId: dup.existingPostId, duplicate: true, raw: dup.raw };
        }
      }
      throw err;
    }
  }

  private parseDuplicate(body?: string): {
    existingPostId?: string;
    raw: unknown;
  } {
    if (!body) return { raw: {} };
    try {
      const parsed = JSON.parse(body) as {
        existingPostId?: string;
        error?: { existingPostId?: string };
      };
      return {
        existingPostId: parsed.existingPostId ?? parsed.error?.existingPostId,
        raw: parsed,
      };
    } catch {
      return { raw: body };
    }
  }

  // ── Analytics (used by a later phase) ─────────────────────────────────────

  async getAnalytics(filter: {
    postId?: string;
    accountId?: string;
    platform?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<unknown> {
    return this.request<unknown>('GET', '/analytics', { query: filter });
  }
}
