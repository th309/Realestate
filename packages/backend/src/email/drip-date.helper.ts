/** Pure UTC day-window boundaries for `daysAgo` days before now. */
export function getDayBoundariesUTC(daysAgo: number): {
  startOfDay: string;
  endOfDay: string;
} {
  const now = new Date();
  const target = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysAgo,
    ),
  );

  const startOfDay = target.toISOString();

  const end = new Date(target);
  end.setUTCDate(end.getUTCDate() + 1);
  const endOfDay = end.toISOString();

  return { startOfDay, endOfDay };
}
