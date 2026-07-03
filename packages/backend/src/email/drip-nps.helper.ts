import React from 'react';
import { NpsDay30 } from '@propertyiq/emails';
import { signNpsToken } from '../surveys/nps-token.util';
import { getEmailLinkBaseUrl } from './email-link-base';
import { buildUnsubscribe } from './unsubscribe-link.util';
import { getDayBoundariesUTC } from './drip-date.helper';
import {
  getAlreadySentUserIds,
  getMarketingOptOutIds,
} from './drip-suppression.helper';
import type { DripDeps } from './drip.types';

/** Cron body: day-30 NPS survey drip under the nps-drip lock. */
export async function runNpsDrip(deps: DripDeps): Promise<void> {
  const locked = await deps.redis.acquireLock('cron:nps-drip', 300);
  if (!locked) {
    deps.logger.log('Another instance is processing NPS drip, skipping');
    return;
  }

  try {
    const jwtSecret = deps.config.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      deps.logger.error('NPS drip: JWT_SECRET not configured');
      return;
    }

    const surveyBaseUrl = `${getEmailLinkBaseUrl(deps.config)}/survey`;

    deps.logger.log('Starting NPS day-30 drip processing...');

    const { startOfDay, endOfDay } = getDayBoundariesUTC(30);

    const { data: eligibleUsers, error: queryError } = await deps.supabase
      .from('user_profiles')
      .select('id, email')
      .gte('created_at', startOfDay)
      .lt('created_at', endOfDay);

    if (queryError) {
      deps.logger.error(`NPS drip: user query failed: ${queryError.message}`);
      return;
    }

    if (!eligibleUsers?.length) {
      deps.logger.log('NPS drip: no eligible users for day 30');
      return;
    }

    const userIds = eligibleUsers.map((u) => u.id);
    const alreadySentIds = await getAlreadySentUserIds(
      deps.supabase,
      userIds,
      'nps_day30',
    );
    const optedOutIds = await getMarketingOptOutIds(deps.supabase, userIds);

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
        const token = signNpsToken(user.id, 'nps_day30', jwtSecret);
        const displayName = user.email.split('@')[0];
        const unsub = buildUnsubscribe(deps.config, user.id);
        const react = React.createElement(NpsDay30, {
          name: displayName,
          surveyBaseUrl,
          token,
          unsubscribeUrl:
            unsub?.url ??
            `${getEmailLinkBaseUrl(deps.config)}/account/notifications`,
        });

        const success = await deps.emailService.sendEmail({
          to: user.email,
          subject: 'How likely are you to recommend PropertyIQ? (30 seconds)',
          react,
          userId: user.id,
          emailType: 'nps_day30',
          headers: unsub?.headers,
        });

        if (success) sent++;
        else failed++;
      } catch (err) {
        deps.logger.error(`NPS drip failed for user ${user.id}:`, err);
        failed++;
      }
    }

    deps.logger.log(
      `NPS day-30 drip complete. Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`,
    );
  } finally {
    await deps.redis.releaseLock('cron:nps-drip');
  }
}
