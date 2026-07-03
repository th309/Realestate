import React from 'react';
import { buildUnsubscribe } from './unsubscribe-link.util';
import { getDayBoundariesUTC } from './drip-date.helper';
import {
  getAlreadySentUserIds,
  getMarketingOptOutIds,
} from './drip-suppression.helper';
import { DRIP_DAY_CONFIGS } from './drip.types';
import type { DripDayConfig, DripDeps } from './drip.types';

/** Cron body: process every onboarding drip day under the onboarding-drip lock. */
export async function runOnboardingDrip(deps: DripDeps): Promise<void> {
  const locked = await deps.redis.acquireLock('cron:onboarding-drip', 300);
  if (!locked) {
    deps.logger.log('Another instance is processing onboarding drip, skipping');
    return;
  }

  try {
    deps.logger.log('Starting onboarding drip processing...');

    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const dayConfig of DRIP_DAY_CONFIGS) {
      const { sent, skipped, failed } = await processDripDay(deps, dayConfig);
      totalSent += sent;
      totalSkipped += skipped;
      totalFailed += failed;
    }

    deps.logger.log(
      `Onboarding drip complete. Sent: ${totalSent}, Skipped: ${totalSkipped}, Failed: ${totalFailed}`,
    );
  } finally {
    await deps.redis.releaseLock('cron:onboarding-drip');
  }
}

/** Send a single drip day to eligible, not-yet-sent, opted-in users. */
export async function processDripDay(
  deps: DripDeps,
  dayConfig: DripDayConfig,
  onlyUserId?: string,
): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const { startOfDay, endOfDay } = getDayBoundariesUTC(dayConfig.day);

  let eligibleQuery = deps.supabase
    .from('user_profiles')
    .select('id, email')
    .gte('created_at', startOfDay)
    .lt('created_at', endOfDay);
  if (onlyUserId) eligibleQuery = eligibleQuery.eq('id', onlyUserId);
  const { data: eligibleUsers, error: queryError } = await eligibleQuery;

  if (queryError) {
    deps.logger.error(
      `Failed to query users for day ${dayConfig.day}: ${queryError.message}`,
    );
    return { sent, skipped, failed };
  }

  if (!eligibleUsers?.length) {
    return { sent, skipped, failed };
  }

  // Batch-check which users already received this email
  const userIds = eligibleUsers.map((u) => u.id);
  const alreadySentIds = await getAlreadySentUserIds(
    deps.supabase,
    userIds,
    dayConfig.emailType,
  );

  // Check for users who opted out of marketing emails
  const optedOutIds = await getMarketingOptOutIds(deps.supabase, userIds);

  for (const user of eligibleUsers) {
    if (!user.email) {
      skipped++;
      continue;
    }

    if (alreadySentIds.has(user.id)) {
      skipped++;
      continue;
    }

    if (optedOutIds.has(user.id)) {
      skipped++;
      continue;
    }

    // Reverse-trial users now receive the nurture drip (days 0/1/3/5/7).
    // Suppress only the end-of-trial pushes (day 10 & 14) — the countdown
    // emails (trial_day_10 / trial_day_13 / trial_expired) own that window.
    if (dayConfig.day === 10 || dayConfig.day === 14) {
      const { data: activeTrial } = await deps.supabase
        .from('user_trials')
        .select('id')
        .eq('user_id', user.id)
        .is('converted_at', null)
        .is('cancelled_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (activeTrial) {
        skipped++;
        continue;
      }
    }

    try {
      const displayName = user.email.split('@')[0];
      const unsub = buildUnsubscribe(deps.config, user.id);
      const unsubscribeUrl =
        unsub?.url ?? `${deps.appUrl}/account/notifications`;
      const react = React.createElement(dayConfig.template, {
        name: displayName,
        loginUrl: deps.appUrl,
        unsubscribeUrl,
      });

      const success = await deps.emailService.sendEmail({
        to: user.email,
        subject: dayConfig.subject,
        react,
        userId: user.id,
        emailType: dayConfig.emailType,
        replyTo: deps.replyTo,
        headers: unsub?.headers,
      });

      if (success) {
        sent++;
      } else {
        failed++;
      }
    } catch (err) {
      deps.logger.error(
        `Failed drip ${dayConfig.emailType} for user ${user.id}:`,
        err,
      );
      failed++;
    }
  }

  if (sent > 0) {
    deps.logger.log(
      `Day ${dayConfig.day} (${dayConfig.emailType}): sent ${sent}, skipped ${skipped}, failed ${failed}`,
    );
  }

  return { sent, skipped, failed };
}
