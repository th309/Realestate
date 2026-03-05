/**
 * Blog Generator Service
 *
 * Generates monthly blog posts using DeepSeek AI based on PropertyIQ score
 * data. Fetches top-scoring markets and score movers from the database,
 * builds prompt context, and returns MDX content for admin review.
 *
 * Three post types:
 * - Top 10 Homebuyer Markets (HomeReady scores)
 * - Top 10 Investor Markets (InvestorEdge scores)
 * - Biggest Score Movers (month-over-month changes)
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { getTopMarkets, getScoreDates } from '../scoring/scoring-queries';
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
  private aiClient: OpenAI | null = null;
  private readonly aiModel: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {
    const deepseekKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    this.aiModel =
      this.configService.get<string>('AI_MODEL') || 'deepseek-chat';

    if (deepseekKey) {
      this.aiClient = new OpenAI({
        apiKey: deepseekKey,
        baseURL:
          this.configService.get<string>('AI_BASE_URL') ||
          'https://api.deepseek.com/v1',
      });
      this.logger.log(
        `DeepSeek initialized for blog generation (model: ${this.aiModel})`,
      );
    } else {
      this.logger.warn(
        'DEEPSEEK_API_KEY not configured — blog generation disabled',
      );
    }
  }

  /**
   * Generate all three monthly blog post types and return their MDX content.
   * Admin reviews the output before publishing.
   */
  async generateMonthlyPosts(): Promise<GeneratedBlogPost[]> {
    if (!this.aiClient) {
      this.logger.warn('AI client not available — skipping blog generation');
      return [];
    }

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
    if (!this.aiClient) return null;

    switch (type) {
      case 'top_homebuyer_markets':
        return this.generateHomebuyerPost();
      case 'top_investor_markets':
        return this.generateInvestorPost();
      case 'biggest_score_movers':
        return this.generateScoreMoversPost();
      default:
        this.logger.warn(`Unknown blog post type: ${type}`);
        return null;
    }
  }

  private async generateHomebuyerPost(): Promise<GeneratedBlogPost> {
    const markets = await this.fetchTopRankedMarkets('homeready');
    const prompt = buildTopHomebuyerMarketsPrompt(markets);
    const mdx = await this.callDeepSeek(prompt);
    return this.buildResult('top_homebuyer_markets', mdx);
  }

  private async generateInvestorPost(): Promise<GeneratedBlogPost> {
    const markets = await this.fetchTopRankedMarkets('investoredge');
    const prompt = buildTopInvestorMarketsPrompt(markets);
    const mdx = await this.callDeepSeek(prompt);
    return this.buildResult('top_investor_markets', mdx);
  }

  private async generateScoreMoversPost(): Promise<GeneratedBlogPost> {
    const { risers, fallers } = await this.fetchBiggestScoreMovers();
    const prompt = buildBiggestScoreMoversPrompt(risers, fallers);
    const mdx = await this.callDeepSeek(prompt);
    return this.buildResult('biggest_score_movers', mdx);
  }

  /**
   * Fetch top 10 markets for a given score type at the metro level.
   * Uses the existing getTopMarkets query from scoring-queries.
   */
  private async fetchTopRankedMarkets(
    scoreType: 'homeready' | 'investoredge',
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
          .eq('score_type', 'homeready')
          .eq('score_date', currentDate),
        this.supabase
          .from('propertyiq_scores')
          .select('location_id, score')
          .eq('geography', 'metro')
          .eq('score_type', 'homeready')
          .eq('score_date', previousDate),
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

  private async callDeepSeek(prompt: string): Promise<string> {
    if (!this.aiClient) return '';

    const response = await this.aiClient.chat.completions.create({
      model: this.aiModel,
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0]?.message?.content || '';
  }

  private buildResult(type: BlogPostType, mdx: string): GeneratedBlogPost {
    return {
      type,
      mdx,
      generated_at: new Date().toISOString(),
      model: this.aiModel,
    };
  }
}
