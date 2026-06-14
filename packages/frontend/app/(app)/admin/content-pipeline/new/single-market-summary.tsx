"use client";
import { FORMAT_META } from "../lib/format-previews";

export function SingleMarketSummary({
  format,
  market,
  publishLine,
  outcomeLine,
}: {
  format: string;
  market: string;
  publishLine: string;
  outcomeLine: string;
}) {
  const meta = FORMAT_META[format];
  return (
    <>
      <h1 className="text-2xl font-semibold mb-4">
        {meta.displayName} for {market}
      </h1>
      <p className="mb-3">We will:</p>
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>
          Write a {meta.duration}-second script ({meta.aspect}) with 1 hook
          variant
        </li>
        <li>Use the PropertyIQ voice (Edge TTS, free)</li>
        <li>{publishLine}</li>
        <li>{outcomeLine}</li>
      </ul>
    </>
  );
}
