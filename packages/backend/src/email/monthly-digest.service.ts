/**
 * Monthly Digest Service
 *
 * Sends a personalized monthly digest email to users who have completed
 * the preference quiz. Runs on the 1st of each month at noon UTC.
 *
 * Orchestration flow per user:
 * 1. Fetch quiz preferences (goal, priorities, budget)
 * 2. Compute top 5 market matches via MarketMatchService
 * 3. Enrich with PIQ scores and region names via MonthlyDigestDataService
 * 4. Build watchlist movers and "market to watch"
 * 5. Send via EmailService with React Email template
 *
 * Dedup: Checks email_log for 'monthly_digest' within the current month.
 * Opt-out: Checks email_preferences.marketing === false.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { MonthlyDigest } from '@propertyiq/emails';
import React from 'react';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { EmailService } from './email.service';
import { MonthlyDigestDataService } from './monthly-digest-data.service';
import { PreferencesService } from '../preferences/preferences.service';
import { MarketMatchService } from '../preferences/market-match.service';
import { formatBudgetRange } from './monthly-digest.types';

@Injectable()
export class MonthlyDigestService {
  private readonly logger = new Logger(MonthlyDigestService.name);
  private readonly appUrl: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly emailService: EmailService,
    private readonly digestData: MonthlyDigestDataService,
    private readonly preferencesService: PreferencesService,
    private readonly marketMatchService: MarketMatchService,
    private readonly config: ConfigService,
  ) {
    this.appUrl =
      this.config.get<string>('FRONTEND_URL') || 'https://propertyiq.app';
  }

  @Cron('0 12 1 * *')
  async sendMonthlyDigests() {
    this.logger.log('Starting monthly digest processing...');

    const eligibleUsers = await this.digestData.getEligibleUsers();
    if (!eligibleUsers.length) {
      this.logger.log('No eligible users for monthly digest');
      return;
    }

    const userIds = eligibleUsers.map((u) => u.id);
    const alreadySentIds =
      await this.digestData.getAlreadySentThisMonth(userIds);
    const optedOutIds = await this.digestData.getMarketingOptOutIds(userIds);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of eligibleUsers) {
      if (
        !user.email ||
        alreadySentIds.has(user.id) ||
        optedOutIds.has(user.id)
      ) {
        skipped++;
        continue;
      }

      try {
        const success = await this.sendDigestForUser(user.id, user.email);
        if (success) sent++;
        else skipped++;
      } catch (err) {
        this.logger.error(`Failed monthly digest for user ${user.id}:`, err);
        failed++;
      }
    }

    this.logger.log(
      `Monthly digest complete. Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`,
    );
  }

  private async sendDigestForUser(
    userId: string,
    email: string,
  ): Promise<boolean> {
    const prefs = await this.preferencesService.getPreferences(userId);
    if (!prefs || !prefs.goal || !prefs.priorities?.length) {
      return false;
    }

    const topMatches = await this.marketMatchService.getTopMatches(
      userId,
      'metro',
      5,
    );
    if (topMatches.length === 0) {
      return false;
    }

    // Enrich match results with region names and PIQ scores
    const topMatchIds = topMatches.map((m) => m.regionId);
    const [regionNames, piqScores, prevPiqScores] = await Promise.all([
      this.digestData.lookupRegionNames(topMatchIds, 'metro'),
      this.digestData.lookupLatestPiqScores(topMatchIds, 'metro'),
      this.digestData.lookupPreviousPiqScores(topMatchIds, 'metro'),
    ]);

    const topMarkets = topMatches.map((m) => {
      const currentPiq = piqScores.get(m.regionId) ?? 0;
      const prevPiq = prevPiqScores.get(m.regionId) ?? currentPiq;
      return {
        name: regionNames.get(m.regionId) || m.regionId,
        matchScore: Math.round(m.matchScore),
        piqScore: Math.round(currentPiq),
        change: Math.round(currentPiq - prevPiq),
      };
    });

    const [watchlistMovers, marketToWatch] = await Promise.all([
      this.digestData.buildWatchlistMovers(userId),
      this.digestData.pickMarketToWatch(topMatchIds),
    ]);

    const budgetRange = formatBudgetRange(prefs.budget_min, prefs.budget_max);
    const displayName = email.split('@')[0];
    const monthName = new Date().toLocaleString('en-US', { month: 'long' });

    const react = React.createElement(MonthlyDigest, {
      name: displayName,
      goal: prefs.goal,
      priorities: prefs.priorities,
      budgetRange,
      topMarkets,
      watchlistMovers,
      marketToWatch,
      dashboardUrl: `${this.appUrl}/dashboard`,
    });

    return this.emailService.sendEmail({
      to: email,
      subject: `Your ${monthName} Market Digest — Top ${topMarkets.length} Matches`,
      react,
      userId,
      emailType: 'monthly_digest',
      metadata: {
        topMatchCount: topMarkets.length,
        watchlistMoverCount: watchlistMovers.length,
        hasMarketToWatch: !!marketToWatch,
      },
    });
  }
}
