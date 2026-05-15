import type { BrrrrInput, BrrrrTimelineResult } from "./types";

export function computeBrrrrTimeline(
  _input: BrrrrInput,
  opts?: {
    rehabMonths?: number;
    leaseMonths?: number;
    seasoningMonths?: number;
  },
): BrrrrTimelineResult {
  const rehab = opts?.rehabMonths ?? 3;
  const lease = opts?.leaseMonths ?? 1;
  const season = opts?.seasoningMonths ?? 6;

  const buyEnd = 0;
  const rehabEnd = buyEnd + rehab;
  const leaseEnd = rehabEnd + lease;
  const seasonEnd = leaseEnd + season;
  const refiEnd = seasonEnd + 1;

  return {
    phases: [
      { id: "buy", label: "Buy", monthStart: 0, monthEnd: buyEnd },
      { id: "rehab", label: "Rehab", monthStart: buyEnd, monthEnd: rehabEnd },
      {
        id: "lease",
        label: "Lease Up",
        monthStart: rehabEnd,
        monthEnd: leaseEnd,
      },
      {
        id: "season",
        label: "Season",
        monthStart: leaseEnd,
        monthEnd: seasonEnd,
      },
      { id: "refi", label: "Refi", monthStart: seasonEnd, monthEnd: refiEnd },
      {
        id: "stabilized",
        label: "Stabilized",
        monthStart: refiEnd,
        monthEnd: null,
      },
    ],
    monthsToFirstRefi: rehab + lease + season,
  };
}
