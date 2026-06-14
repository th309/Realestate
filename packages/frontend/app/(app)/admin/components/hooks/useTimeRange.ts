"use client";

/**
 * USE TIME RANGE HOOK
 *
 * Manages the selected time range for admin charts and time-series data.
 * Calculates ISO `from` and `to` strings from a named key, or accepts a
 * fully custom range via setCustomRange.
 */

import { useState, useCallback } from "react";

export type TimeRangeKey =
  | "1h"
  | "24h"
  | "7d"
  | "30d"
  | "90d"
  | "6m"
  | "1y"
  | "custom";

export interface TimeRange {
  key: TimeRangeKey;
  from: string;
  to: string;
}

function calculateFrom(key: TimeRangeKey, now: Date): string {
  const d = new Date(now);

  switch (key) {
    case "1h":
      d.setHours(d.getHours() - 1);
      break;
    case "24h":
      d.setDate(d.getDate() - 1);
      break;
    case "7d":
      d.setDate(d.getDate() - 7);
      break;
    case "30d":
      d.setDate(d.getDate() - 30);
      break;
    case "90d":
      d.setDate(d.getDate() - 90);
      break;
    case "6m":
      d.setMonth(d.getMonth() - 6);
      break;
    case "1y":
      d.setFullYear(d.getFullYear() - 1);
      break;
    default:
      // 'custom' — caller sets via setCustomRange; return sentinel
      return "";
  }

  return d.toISOString();
}

export function useTimeRange(defaultKey: TimeRangeKey = "30d") {
  const now = new Date();
  const [range, setRangeState] = useState<TimeRange>({
    key: defaultKey,
    from: calculateFrom(defaultKey, now),
    to: now.toISOString(),
  });

  const setRange = useCallback((key: TimeRangeKey) => {
    const nowNow = new Date();
    setRangeState({
      key,
      from: calculateFrom(key, nowNow),
      to: nowNow.toISOString(),
    });
  }, []);

  const setCustomRange = useCallback((from: string, to: string) => {
    setRangeState({ key: "custom", from, to });
  }, []);

  return { range, setRange, setCustomRange };
}
