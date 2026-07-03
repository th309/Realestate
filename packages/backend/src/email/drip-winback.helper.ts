import React from 'react';
import { WinbackDay14 } from '@propertyiq/emails';
import { buildUnsubscribe } from './unsubscribe-link.util';
import {
  getAlreadySentUserIds,
  getMarketingOptOutIds,
} from './drip-suppression.helper';
import type { DripDeps } from './drip.types';

/** Cron body: win-back drip for users last active ~14 days ago with 3+ sessions. */
export async function runWinbackDrip(deps: DripDeps): Promise<void> {
  const locked = await deps.redis.acquireLock('cron:winback-drip', 300);
  if (!locked) {
    deps.logger.log('Another instance is processing winback drip, skipping');
    return;
  }

  try {
    deps.logger.log('Starting win-back drip processing...');

    // Find users whose last activity was exactly 14 days ago with 3+ sessions
    const churnCutoffStart = new Date(
      Date.now() - 15 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const churnCutoffEnd = new Date(
      Date.now() - 14 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Get user sessions with last activity in the 14-day window
    const { data: sessions, error: sessionsError } = await deps.supabase
      .from('user_sessions')
      .select('user_id, last_activity_at')
      .not('user_id', 'is', null)
      .gte('last_activity_at', churnCutoffStart)
      .lt('last_activity_at', churnCutoffEnd);

    if (sessionsError) {
      deps.logger.error(
        `Win-back: session query failed: ${sessionsError.message}`,
      );
      return;
    }

    if (!sessions?.length) {
      deps.logger.log('Win-back: no eligible users found');
      return;
    }

    // Count sessions per user — only send to users with 3+ sessions
    const sessionCountByUser = new Map<string, number>();
    for (const row of sessions) {
      sessionCountByUser.set(
        row.user_id,
        (sessionCountByUser.get(row.user_id) ?? 0) + 1,
      );
    }

    const eligibleUserIds = Array.from(sessionCountByUser.entries())
      .filter(([, count]) => count >= 3)
      .map(([userId]) => userId);

    if (!eligibleUserIds.length) {
      deps.logger.log('Win-back: no users with 3+ sessions found');
      return;
    }

    // Get emails for eligible users
    const { data: profiles, error: profilesError } = await deps.supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', eligibleUserIds);

    if (profilesError || !profiles?.length) {
      deps.logger.log('Win-back: no user profiles found for eligible users');
      return;
    }

    const alreadySentIds = await getAlreadySentUserIds(
      deps.supabase,
      eligibleUserIds,
      'winback_day14',
    );
    const optedOutIds = await getMarketingOptOutIds(
      deps.supabase,
      eligibleUserIds,
    );

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of profiles) {
      if (
        !user.email ||
        alreadySentIds.has(user.id) ||
        optedOutIds.has(user.id)
      ) {
        skipped++;
        continue;
      }

      try {
        const displayName = user.email.split('@')[0];
        const unsub = buildUnsubscribe(deps.config, user.id);
        const react = React.createElement(WinbackDay14, {
          name: displayName,
          loginUrl: deps.appUrl,
          unsubscribeUrl: unsub?.url ?? `${deps.appUrl}/account/notifications`,
        });

        const success = await deps.emailService.sendEmail({
          to: user.email,
          subject: 'Markets have moved since you last checked in',
          react,
          userId: user.id,
          emailType: 'winback_day14',
          headers: unsub?.headers,
        });

        if (success) sent++;
        else failed++;
      } catch (err) {
        deps.logger.error(`Win-back failed for user ${user.id}:`, err);
        failed++;
      }
    }

    deps.logger.log(
      `Win-back drip complete. Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`,
    );
  } finally {
    await deps.redis.releaseLock('cron:winback-drip');
  }
}
