// packages/backend/src/email/drip-churn-why.helper.ts
import React from 'react';
import {
  ChurnWhyAsk,
  CHURN_WHY_ZERO_SESSION,
  CHURN_WHY_TRIED_ONCE,
  CHURN_WHY_ENGAGED_QUIET,
  type ChurnWhyCopy,
} from '@propertyiq/emails';
import { signNpsToken } from '../surveys/nps-token.util';
import { buildUnsubscribe } from './unsubscribe-link.util';
import { getDayBoundariesUTC } from './drip-date.helper';
import {
  getAlreadySentUserIds,
  getMarketingOptOutIds,
} from './drip-suppression.helper';
import { getSessionCountsForUsers } from '../common/user-sessions-count.util';
import {
  isZeroSessionEligible,
  isTriedOnceEligible,
  isEngagedThenQuietEligible,
} from './churn-cohort-rules';
import type { DripDeps } from './drip.types';

type EmailUser = { id: string; email: string | null };
type DripResult = { sent: number; skipped: number; failed: number };

const EMAIL_TYPES = {
  zero_session: 'churn_why_zero_session',
  tried_once: 'churn_why_tried_once',
  engaged_quiet: 'churn_why_engaged_quiet',
} as const;

/** Cron body: all three churn-why cohorts, replacing the old win-back email. */
export async function runChurnWhyDrip(deps: DripDeps): Promise<void> {
  const locked = await deps.redis.acquireLock('cron:churn-why-drip', 300);
  if (!locked) {
    deps.logger.log('Another instance is processing churn-why drip, skipping');
    return;
  }

  try {
    deps.logger.log('Starting churn-why drip processing...');

    const results = await Promise.all([
      runChurnWhyCohort(deps, EMAIL_TYPES.zero_session),
      runChurnWhyCohort(deps, EMAIL_TYPES.tried_once),
      runChurnWhyCohort(deps, EMAIL_TYPES.engaged_quiet),
    ]);

    const totals = results.reduce(
      (acc, r) => ({
        sent: acc.sent + r.sent,
        skipped: acc.skipped + r.skipped,
        failed: acc.failed + r.failed,
      }),
      { sent: 0, skipped: 0, failed: 0 },
    );

    deps.logger.log(
      `Churn-why drip complete. Sent: ${totals.sent}, Skipped: ${totals.skipped}, Failed: ${totals.failed}`,
    );
  } finally {
    await deps.redis.releaseLock('cron:churn-why-drip');
  }
}

/** Dev/test entry: run one cohort by its email_type, optionally scoped to one user. */
export async function runChurnWhyCohort(
  deps: DripDeps,
  emailType: string,
  onlyUserId?: string,
): Promise<DripResult> {
  if (emailType === EMAIL_TYPES.zero_session) {
    return runSnapshotCohort(deps, {
      day: 4,
      emailType: EMAIL_TYPES.zero_session,
      copy: CHURN_WHY_ZERO_SESSION,
      isEligible: isZeroSessionEligible,
      onlyUserId,
    });
  }
  if (emailType === EMAIL_TYPES.tried_once) {
    return runSnapshotCohort(deps, {
      day: 7,
      emailType: EMAIL_TYPES.tried_once,
      copy: CHURN_WHY_TRIED_ONCE,
      isEligible: isTriedOnceEligible,
      onlyUserId,
    });
  }
  if (emailType === EMAIL_TYPES.engaged_quiet) {
    return runEngagedQuietCohort(deps, onlyUserId);
  }
  throw new Error(`Unknown churn-why cohort email type: ${emailType}`);
}

/** Zero-session and tried-once: a day-since-signup snapshot, same pattern as
 * the onboarding drip's getDayBoundariesUTC(day) — not a rolling window. */
async function runSnapshotCohort(
  deps: DripDeps,
  config: {
    day: number;
    emailType: string;
    copy: ChurnWhyCopy;
    isEligible: (sessionCount: number) => boolean;
    onlyUserId?: string;
  },
): Promise<DripResult> {
  const { startOfDay, endOfDay } = getDayBoundariesUTC(config.day);

  let query = deps.supabase
    .from('user_profiles')
    .select('id, email')
    .gte('created_at', startOfDay)
    .lt('created_at', endOfDay);
  if (config.onlyUserId) query = query.eq('id', config.onlyUserId);

  const { data: candidates, error } = await query;
  if (error) {
    deps.logger.error(
      `Churn-why (${config.emailType}): candidate query failed: ${error.message}`,
    );
    return { sent: 0, skipped: 0, failed: 0 };
  }
  if (!candidates?.length) return { sent: 0, skipped: 0, failed: 0 };

  const userIds = candidates.map((u) => u.id);
  const sessionCounts = await getSessionCountsForUsers(deps.supabase, userIds);
  const eligible = candidates.filter((u) =>
    config.isEligible(sessionCounts.get(u.id) ?? 0),
  );
  if (!eligible.length) return { sent: 0, skipped: 0, failed: 0 };

  return sendChurnWhyEmails(deps, eligible, config.emailType, config.copy);
}

/** Engaged-then-quiet: 3+ sessions in a specific day 14-15 days ago (the same
 * rolling-dormancy query the old win-back email used), then silent since. */
async function runEngagedQuietCohort(
  deps: DripDeps,
  onlyUserId?: string,
): Promise<DripResult> {
  const churnCutoffStart = new Date(
    Date.now() - 15 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const churnCutoffEnd = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000,
  ).toISOString();

  let sessionQuery = deps.supabase
    .from('user_sessions')
    .select('user_id, last_activity_at')
    .not('user_id', 'is', null)
    .gte('last_activity_at', churnCutoffStart)
    .lt('last_activity_at', churnCutoffEnd);
  if (onlyUserId) sessionQuery = sessionQuery.eq('user_id', onlyUserId);

  const { data: sessions, error } = await sessionQuery;
  if (error) {
    deps.logger.error(
      `Churn-why (engaged_quiet): session query failed: ${error.message}`,
    );
    return { sent: 0, skipped: 0, failed: 0 };
  }
  if (!sessions?.length) return { sent: 0, skipped: 0, failed: 0 };

  const sessionCountByUser = new Map<string, number>();
  for (const row of sessions) {
    sessionCountByUser.set(
      row.user_id,
      (sessionCountByUser.get(row.user_id) ?? 0) + 1,
    );
  }

  const eligibleUserIds = Array.from(sessionCountByUser.entries())
    .filter(([, count]) => isEngagedThenQuietEligible(count))
    .map(([userId]) => userId);
  if (!eligibleUserIds.length) return { sent: 0, skipped: 0, failed: 0 };

  const { data: profiles } = await deps.supabase
    .from('user_profiles')
    .select('id, email')
    .in('id', eligibleUserIds);
  if (!profiles?.length) return { sent: 0, skipped: 0, failed: 0 };

  return sendChurnWhyEmails(
    deps,
    profiles,
    EMAIL_TYPES.engaged_quiet,
    CHURN_WHY_ENGAGED_QUIET,
  );
}

/** Shared send loop: suppression, token, template, EmailService — used by all
 * three cohorts so the send/skip/fail accounting stays in one place. */
async function sendChurnWhyEmails(
  deps: DripDeps,
  users: EmailUser[],
  emailType: string,
  copy: ChurnWhyCopy,
): Promise<DripResult> {
  const userIds = users.map((u) => u.id);
  const alreadySentIds = await getAlreadySentUserIds(
    deps.supabase,
    userIds,
    emailType,
  );
  const optedOutIds = await getMarketingOptOutIds(deps.supabase, userIds);

  const jwtSecret = deps.config.get<string>('JWT_SECRET');
  if (!jwtSecret) {
    deps.logger.error(`Churn-why (${emailType}): JWT_SECRET not configured`);
    return { sent: 0, skipped: 0, failed: users.length };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
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
      const token = signNpsToken(user.id, emailType, jwtSecret);
      const unsub = buildUnsubscribe(deps.config, user.id);
      const react = React.createElement(ChurnWhyAsk, {
        name: displayName,
        copy,
        whyDidYouLeaveUrl: `${deps.appUrl}/why-did-you-leave`,
        token,
        unsubscribeUrl: unsub?.url ?? `${deps.appUrl}/account/notifications`,
      });

      const success = await deps.emailService.sendEmail({
        to: user.email,
        subject: copy.heading,
        react,
        userId: user.id,
        emailType,
        replyTo: deps.replyTo,
        headers: unsub?.headers,
      });

      if (success) sent++;
      else failed++;
    } catch (err) {
      deps.logger.error(`Churn-why (${emailType}) failed for ${user.id}:`, err);
      failed++;
    }
  }

  return { sent, skipped, failed };
}
