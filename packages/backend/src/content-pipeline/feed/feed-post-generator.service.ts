// packages/backend/src/content-pipeline/feed/feed-post-generator.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AiProviderService } from '../../ai-provider/ai-provider.service';
import { AI_PURPOSES } from '../../ai-provider/ai-provider.types';
import type { BrandProfile } from '../brand-kit/brand-kit.types';
import { PostsService } from '../posts/posts.service';
import { ContentDataService } from '../data/content-data.service';
import { BrandVoiceLinterService } from '../gates/brand-voice-linter.service';
import { PostImageRenderService } from '../post-images/post-image-render.service';
import type { PostCopy, PostRow } from '../posts/post.types';
import {
  FEED_POST_TYPE_PLATFORM,
  FeedGenerationOutcome,
  FeedPostType,
  GroundingTarget,
} from './feed.types';
import { buildFeedUserPrompt } from './feed-prompts';
import {
  buildGrounding,
  coerceVideoScriptCopy,
  flattenCopyForLint,
  usdFromUsage,
} from './feed-helpers';
import type { FeedMarketGrounding } from './feed.types';
import {
  assertNonBlankPostCopy,
  assertNonEmptyCompletion,
  EmptyCompletionError,
  parseJsonObject,
} from './generation-guards';

const POST_MAX_TOKENS = 1200;

/** One generation attempt: outcome, the created post (if any), and spend to bill. */
export interface GenerateResult {
  outcome: FeedGenerationOutcome;
  post: PostRow | null;
  spentUsd: number;
  spentTokens: number;
}

/**
 * The per-post generation core: ground in real data, generate copy via the
 * DeepSeek post_generation purpose, run Gate B, insert the post, and render its
 * branded images. Never throws — returns an outcome plus the spend to accumulate
 * (billed even on failure, since DeepSeek charges reasoning tokens on a silent
 * empty response). Split from FeedService to keep both under the file-size limit.
 */
@Injectable()
export class FeedPostGeneratorService {
  private readonly logger = new Logger(FeedPostGeneratorService.name);

  constructor(
    private readonly ai: AiProviderService,
    private readonly contentData: ContentDataService,
    private readonly linter: BrandVoiceLinterService,
    private readonly posts: PostsService,
    private readonly postImages: PostImageRenderService,
  ) {}

  async generatePost(
    brand: BrandProfile,
    preamble: string,
    postType: FeedPostType,
    target: GroundingTarget,
    options?: { platform?: string; brief?: string },
  ): Promise<GenerateResult> {
    const ctx = `${postType}/${target.canonical_name}`;
    let spentUsd = 0;
    let spentTokens = 0;
    try {
      const snapshot = await this.contentData
        .getMarketSnapshot({
          geography: target.geography,
          id: target.id,
          canonical_name: target.canonical_name,
        })
        .catch(() => null);
      const grounding = buildGrounding(target, snapshot);
      const userPrompt = buildFeedUserPrompt(
        postType,
        grounding,
        options?.brief,
      );

      const resp = await this.ai.complete(AI_PURPOSES.POST_GENERATION, {
        systemPrompt: preamble,
        userPrompt,
        maxTokens: POST_MAX_TOKENS,
        temperature: 0.8,
        responseFormat: 'json',
      });
      spentUsd += usdFromUsage(resp.model, resp.usage);
      spentTokens += resp.usage?.totalTokens ?? 0;

      assertNonEmptyCompletion(resp.content, ctx);
      const copy = parseJsonObject<PostCopy>(resp.content, ctx);
      assertNonBlankPostCopy(copy, postType, ctx);
      // video_script is a suggestion: drop an invalid model-picked format + clamp runtime.
      if (postType === 'video_script') coerceVideoScriptCopy(copy);

      const lint = await this.linter.lint(flattenCopyForLint(copy));
      if (!lint.passed) {
        return this.result(
          {
            postType,
            marketName: target.canonical_name,
            status: 'lint_failed',
            reason: `${lint.violations.length} violation(s)`,
          },
          null,
          spentUsd,
          spentTokens,
        );
      }

      const post = await this.posts.createPost({
        brandId: brand.id,
        platform: options?.platform ?? FEED_POST_TYPE_PLATFORM[postType],
        postType,
        copy,
        status: 'pending_review',
        source: 'ai_generated',
      });
      // Render after Gate B; a render failure leaves the draft alive.
      // video_script renders nothing (a suggestion, not a post). Re-read so the
      // returned post carries the freshly-written media_refs (the /generate
      // response + its preview depend on it — a stale pre-render row shows none).
      const rendered = await this.renderImagesBestEffort(post, grounding);
      return this.result(
        {
          postType,
          marketName: target.canonical_name,
          status: 'inserted',
          postId: post.id,
        },
        rendered,
        spentUsd,
        spentTokens,
      );
    } catch (err) {
      const empty = err instanceof EmptyCompletionError;
      this.logger.error(
        `feed generation failed (${ctx}): ${(err as Error).message}`,
      );
      return this.result(
        {
          postType,
          marketName: target.canonical_name,
          status: empty ? 'empty_completion' : 'error',
          reason: (err as Error).message,
        },
        null,
        spentUsd,
        spentTokens,
      );
    }
  }

  /**
   * Render post images and attach them; returns the post with media_refs written
   * (or the original row if nothing rendered / the render failed — best-effort,
   * the draft always survives).
   */
  private async renderImagesBestEffort(
    post: PostRow,
    grounding: FeedMarketGrounding,
  ): Promise<PostRow> {
    try {
      const refs = await this.postImages.renderForPost(post, grounding);
      if (refs.length > 0)
        return await this.posts.updateMediaRefs(post.id, refs);
    } catch (err) {
      this.logger.error(
        `post-image render failed for ${post.id}: ${(err as Error).message}`,
      );
    }
    return post;
  }

  private result(
    outcome: FeedGenerationOutcome,
    post: PostRow | null,
    spentUsd: number,
    spentTokens: number,
  ): GenerateResult {
    return { outcome, post, spentUsd, spentTokens };
  }
}
