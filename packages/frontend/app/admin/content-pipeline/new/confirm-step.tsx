"use client";
import { useState } from "react";
import { createRun } from "../lib/content-pipeline-api";
import { FORMAT_META } from "../lib/format-previews";

export function ConfirmStep({
  format,
  market,
  onBack,
  onCreated,
}: {
  format: string;
  market: string;
  onBack: () => void;
  onCreated: (runId: string) => void;
}) {
  const meta = FORMAT_META[format];
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = crypto.randomUUID();

  async function submit() {
    setSubmitting(true);
    try {
      const result = await createRun({
        format,
        marketQuery: market,
        idempotencyKey,
      });
      onCreated(result.id);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={onBack} className="text-sm text-primary mb-4">
        Back
      </button>
      <div className="rounded-xl bg-surface-container-low p-8 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4">
          {meta.displayName} for {market}
        </h1>
        <p className="mb-3">We will:</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Write a {meta.duration}-second script with 1 hook variant</li>
          <li>Use the PropertyIQ voice (Edge TTS, free)</li>
          <li>Post to YouTube Shorts</li>
          <li>Queue for your review before publishing</li>
        </ul>
        {error && <div className="mt-4 text-error">{error}</div>}
        <button
          onClick={submit}
          disabled={submitting}
          className="mt-6 bg-primary text-on-primary rounded-full px-8 py-3 font-semibold disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Start Run"}
        </button>
      </div>
    </div>
  );
}
