export interface EligibleUser {
  id: string;
  email: string;
}

interface SubscriptionRow {
  user_id: string;
  user_profiles:
    | { id: string; email: string }
    | { id: string; email: string }[]
    | null;
}

export function getFutureDayBoundaries(daysFromNow: number): {
  rangeStart: string;
  rangeEnd: string;
} {
  const now = new Date();
  const target = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysFromNow,
    ),
  );
  const next = new Date(target);
  next.setUTCDate(next.getUTCDate() + 1);
  return { rangeStart: target.toISOString(), rangeEnd: next.toISOString() };
}

export function getPastDayBoundaries(daysAgo: number): {
  rangeStart: string;
  rangeEnd: string;
} {
  const now = new Date();
  const target = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysAgo,
    ),
  );
  const next = new Date(target);
  next.setUTCDate(next.getUTCDate() + 1);
  return { rangeStart: target.toISOString(), rangeEnd: next.toISOString() };
}

export function extractUsersFromSubscriptions(
  rows: SubscriptionRow[],
): EligibleUser[] {
  const users: EligibleUser[] = [];
  for (const row of rows) {
    if (!row.user_profiles) continue;
    const profile = Array.isArray(row.user_profiles)
      ? row.user_profiles[0]
      : row.user_profiles;
    if (profile?.id && profile?.email) {
      users.push({ id: profile.id, email: profile.email });
    }
  }
  return users;
}
