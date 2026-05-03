"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Pulling 14 market signals…",
  "Comparing against peer markets…",
  "Building 12-month forecast…",
  "Drafting strategy synthesis…",
];
const ROTATE_MS = 2800;
const STUCK_MS = 15_000;

export function ListingPresentationLoading({
  marketName,
}: {
  marketName: string;
}) {
  const [idx, setIdx] = useState(0);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const rotateTimer = setInterval(
      () => setIdx((i) => Math.min(i + 1, MESSAGES.length - 1)),
      ROTATE_MS,
    );
    const stuckTimer = setTimeout(() => setStuck(true), STUCK_MS);
    return () => {
      clearInterval(rotateTimer);
      clearTimeout(stuckTimer);
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading listing presentation"
        className="h-12 w-12 animate-spin rounded-full border-[3px] border-primary/30 border-t-primary"
      />
      <p className="mt-5 text-base font-medium text-on-surface">
        Building your {marketName} listing presentation
      </p>
      <p className="mt-1 text-sm text-on-surface-variant">{MESSAGES[idx]}</p>
      {stuck && (
        <p className="mt-4 text-xs text-on-surface-variant/80">
          Still working on it. Larger markets take a bit longer.
        </p>
      )}
    </div>
  );
}
