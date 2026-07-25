"use client";

import type { GeneratePostType } from "../lib/posts-api";
import { TOPIC_MAX_LENGTH, usesTopicGrounding } from "./create-post-machine";
import { MarketSearch } from "./market-search";

/**
 * Step 2: ground the post. Image and carousel posts are grounded by a market
 * (typeahead → canonical name); a `from_topic` post is grounded by free text,
 * capped at the length the server accepts. Continue stays disabled until the
 * grounding is actually valid.
 */
export function GroundingStep({
  type,
  marketQuery,
  topic,
  onMarketQuery,
  onTopic,
  canContinue,
  onBack,
  onContinue,
}: {
  type: GeneratePostType;
  marketQuery: string;
  topic: string;
  onMarketQuery: (value: string) => void;
  onTopic: (value: string) => void;
  canContinue: boolean;
  /** Absent on the first step (nothing to go back to but the studio link). */
  onBack?: () => void;
  onContinue: () => void;
}) {
  const isTopic = usesTopicGrounding(type);
  const remaining = TOPIC_MAX_LENGTH - topic.length;

  return (
    <div className="space-y-6">
      {isTopic ? (
        <div>
          <label
            htmlFor="create-post-topic"
            className="mb-2 block text-sm font-medium text-on-surface"
          >
            What&apos;s the post about?
          </label>
          <textarea
            id="create-post-topic"
            value={topic}
            onChange={(e) => onTopic(e.target.value.slice(0, TOPIC_MAX_LENGTH))}
            maxLength={TOPIC_MAX_LENGTH}
            rows={4}
            autoFocus
            placeholder="e.g. Why Sun Belt renters are becoming first-time buyers this year"
            className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
          <div className="mt-1 flex justify-end">
            <span
              className={`text-xs tabular-nums ${
                remaining <= 20 ? "text-warning" : "text-on-surface-variant"
              }`}
            >
              {remaining} left
            </span>
          </div>
        </div>
      ) : marketQuery ? (
        <SelectedMarket
          marketQuery={marketQuery}
          onChange={() => onMarketQuery("")}
        />
      ) : (
        <MarketSearch onPick={onMarketQuery} />
      )}

      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-on-surface transition-colors duration-200 hover:bg-surface-container-high"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="rounded-full bg-primary px-8 py-2.5 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary/90 disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function SelectedMarket({
  marketQuery,
  onChange,
}: {
  marketQuery: string;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-on-surface-variant">
          Market
        </p>
        <p className="truncate text-base font-medium text-on-surface">
          {marketQuery}
        </p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 text-sm font-semibold text-primary transition-colors duration-200 hover:text-primary/80"
      >
        Change
      </button>
    </div>
  );
}
