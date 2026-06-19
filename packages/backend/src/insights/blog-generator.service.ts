/**
 * Blog Generator Service
 *
 * Generates monthly blog posts using DeepSeek AI based on PropertyIQ score
 * data. Fetches top-scoring markets and score movers from the database,
 * builds prompt context, and returns MDX content for admin review.
 *
 * Post types:
 * - Top 10 PropertyIQ Markets (unified score)
 * - Biggest Score Movers (month-over-month changes)
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { AiProviderService } from '../ai-provider/ai-provider.service';
import { AI_PURPOSES } from '../ai-provider/ai-provider.types';
import { getTopMarkets, getScoreDates } from '../scoring/scoring-queries';
import type { ScoreType } from '../scoring/formula-weights';
import {
  BlogPostType,
  RankedMarket,
  ScoreMover,
  buildTopHomebuyerMarketsPrompt,
  buildTopInvestorMarketsPrompt,
  buildBiggestScoreMoversPrompt,
} from './blog-prompts';

export interface GeneratedBlogPost {
  type: BlogPostType;
  mdx: string;
  generated_at: string;
  model: string;
}

@Injectable()
export class BlogGeneratorService {
  private readonly logger = new Logger(BlogGeneratorService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly aiProvider: AiProviderService,
  ) {}

  /**
   * Generate all three monthly blog post types and return their MDX content.
   * Admin reviews the output before publishing.
   */
  async generateMonthlyPosts(): Promise<GeneratedBlogPost[]> {
    const posts: GeneratedBlogPost[] = [];

    const [homebuyerPost, investorPost, moversPost] = await Promise.allSettled([
      this.generateHomebuyerPost(),
      this.generateInvestorPost(),
      this.generateScoreMoversPost(),
    ]);

    if (homebuyerPost.status === 'fulfilled' && homebuyerPost.value) {
      posts.push(homebuyerPost.value);
    } else if (homebuyerPost.status === 'rejected') {
      this.logger.error(
        'Failed to generate homebuyer post',
        homebuyerPost.reason,
      );
    }

    if (investorPost.status === 'fulfilled' && investorPost.value) {
      posts.push(investorPost.value);
    } else if (investorPost.status === 'rejected') {
      this.logger.error(
        'Failed to generate investor post',
        investorPost.reason,
      );
    }

    if (moversPost.status === 'fulfilled' && moversPost.value) {
      posts.push(moversPost.value);
    } else if (moversPost.status === 'rejected') {
      this.logger.error('Failed to generate movers post', moversPost.reason);
    }

    this.logger.log(`Generated ${posts.length}/3 monthly blog posts`);
    return posts;
  }

  /**
   * Generate a single blog post by type.
   */
  async generatePostByType(
    type: BlogPostType,
  ): Promise<GeneratedBlogPost | null> {
    try {
      switch (type) {
        case 'top_homebuyer_markets':
          return await this.generateHomebuyerPost();
        case 'top_investor_markets':
          return await this.generateInvestorPost();
        case 'biggest_score_movers':
          return await this.generateScoreMoversPost();
        default:
          this.logger.warn(`Unknown blog post type: ${type}`);
          return null;
      }
    } catch (err) {
      this.logger.error(
        `Blog generation failed for ${type}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async generateHomebuyerPost(): Promise<GeneratedBlogPost> {
    const markets = await this.fetchTopRankedMarkets('propertyiq');
    const prompt = buildTopHomebuyerMarketsPrompt(markets);
    const { mdx, model } = await this.generate(prompt);
    return this.buildResult('top_homebuyer_markets', mdx, model);
  }

  private async generateInvestorPost(): Promise<GeneratedBlogPost> {
    const markets = await this.fetchTopRankedMarkets('propertyiq');
    const prompt = buildTopInvestorMarketsPrompt(markets);
    const { mdx, model } = await this.generate(prompt);
    return this.buildResult('top_investor_markets', mdx, model);
  }

  private async generateScoreMoversPost(): Promise<GeneratedBlogPost> {
    const { risers, fallers } = await this.fetchBiggestScoreMovers();
    const prompt = buildBiggestScoreMoversPrompt(risers, fallers);
    const { mdx, model } = await this.generate(prompt);
    return this.buildResult('biggest_score_movers', mdx, model);
  }

  /**
   * Fetch top 10 markets for a given score type at the metro level.
   * Uses the existing getTopMarkets query from scoring-queries.
   */
  private async fetchTopRankedMarkets(
    scoreType: ScoreType,
  ): Promise<RankedMarket[]> {
    const topRows = await getTopMarkets(this.supabase, 'metro', scoreType, 10);

    return topRows.map((row, index) => ({
      rank: index + 1,
      location_name: row.location_name,
      location_id: row.location_id,
      score: row.score,
      grade: row.grade,
    }));
  }

  /**
   * Fetch the biggest month-over-month score movers by comparing the two
   * most recent score dates. Returns the top 5 risers and top 5 fallers.
   */
  private async fetchBiggestScoreMovers(): Promise<{
    risers: ScoreMover[];
    fallers: ScoreMover[];
  }> {
    const scoreDates = await getScoreDates(this.supabase, 'metro', 2);
    if (scoreDates.length < 2) {
      this.logger.warn('Not enough score dates for movers comparison');
      return { risers: [], fallers: [] };
    }

    const [currentDate, previousDate] = scoreDates;

    const [{ data: currentScores }, { data: previousScores }] =
      await Promise.all([
        this.supabase
          .from('propertyiq_scores')
          .select('location_id, location_name, score')
          .eq('geography', 'metro')
          .eq('score_type', 'propertyiq')
          .eq('score_date', currentDate)
          .limit(1000),
        this.supabase
          .from('propertyiq_scores')
          .select('location_id, score')
          .eq('geography', 'metro')
          .eq('score_type', 'propertyiq')
          .eq('score_date', previousDate)
          .limit(1000),
      ]);

    if (!currentScores?.length || !previousScores?.length) {
      return { risers: [], fallers: [] };
    }

    const previousMap = new Map(
      previousScores.map((r: { location_id: string; score: number }) => [
        r.location_id,
        r.score,
      ]),
    );

    const changes: ScoreMover[] = [];
    for (const current of currentScores) {
      const prevScore = previousMap.get(current.location_id);
      if (prevScore == null) continue;
      const change = current.score - prevScore;
      if (Math.abs(change) < 0.5) continue; // Skip negligible changes
      changes.push({
        location_name: current.location_name,
        location_id: current.location_id,
        current_score: current.score,
        previous_score: prevScore,
        change,
        direction: change > 0 ? 'up' : 'down',
      });
    }

    changes.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    const risers = changes.filter((m) => m.direction === 'up').slice(0, 5);
    const fallers = changes.filter((m) => m.direction === 'down').slice(0, 5);

    return { risers, fallers };
  }

  /**
   * Generate MDX via the centralized AI provider. Model is selectable for the
   * `blog_generation` purpose in ai_model_config (default DeepSeek).
   */
  private async generate(
    prompt: string,
  ): Promise<{ mdx: string; model: string }> {
    const response = await this.aiProvider.complete(
      AI_PURPOSES.BLOG_GENERATION,
      { userPrompt: prompt, maxTokens: 2500 },
    );
    return { mdx: response.content, model: response.model };
  }

  private buildResult(
    type: BlogPostType,
    mdx: string,
    model: string,
  ): GeneratedBlogPost {
    return {
      type,
      mdx,
      generated_at: new Date().toISOString(),
      model,
    };
  }
}
