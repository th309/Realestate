"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchInfographicOptions,
  isMissingInfographicCatalog,
} from "../lib/infographic-options-api";
import { InfographicTopicPicker } from "./infographic-topic-picker";
import { InfographicTaskPicker } from "./infographic-task-picker";
import { InfographicStylePicker } from "./infographic-style-picker";
import {
  buildInfographicRunPlan,
  EMPTY_INFOGRAPHIC_SELECTION,
  type InfographicRunPlan,
  type InfographicSelection,
} from "./helpers/infographic-params";

/**
 * Topic + task + style picker for infographic runs. Stands in for the market
 * step: an infographic teaches a product task, so it has no market to pick.
 *
 * The step's structure carries the product rule — a topic doc holds a numbered
 * list of tasks, and one run names exactly one of them.
 */
export function InfographicParamsStep({
  initial,
  onBack,
  onNext,
}: {
  initial?: InfographicSelection;
  onBack: () => void;
  onNext: (selection: InfographicSelection, plan: InfographicRunPlan) => void;
}) {
  const {
    data: options,
    error,
    isPending,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["content-pipeline-infographic-options"],
    queryFn: fetchInfographicOptions,
    staleTime: 5 * 60 * 1000,
    // Surface a missing endpoint immediately instead of retrying into it.
    retry: false,
  });

  const [selection, setSelection] = useState<InfographicSelection>(
    initial ?? EMPTY_INFOGRAPHIC_SELECTION,
  );

  // A style is always required, so the first one stands in until the operator
  // picks another. Derived rather than stored, so it lands correctly whenever
  // the catalog arrives instead of needing a state sync.
  const effective: InfographicSelection = {
    ...selection,
    styleId: selection.styleId || (options?.styles[0]?.id ?? ""),
  };

  const plan = options ? buildInfographicRunPlan(effective, options) : null;
  const selectedTopic = options?.topics.find(
    (t) => t.slug === effective.topicSlug,
  );

  return (
    <div className="p-8 max-w-2xl">
      <button onClick={onBack} className="text-sm text-primary mb-4">
        Back
      </button>

      <h1 className="mb-2 text-2xl font-semibold">
        Infographic — pick one task
      </h1>
      <p className="mb-8 text-sm text-on-surface-variant">
        Every graphic teaches exactly one task. Pick the topic, then the single
        task it covers.
      </p>

      {isPending && (
        <p className="mb-8 rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          Loading topics…
        </p>
      )}

      {error && (
        <CatalogLoadError
          missing={isMissingInfographicCatalog(error)}
          message={error instanceof Error ? error.message : String(error)}
          retrying={isFetching}
          onRetry={() => void refetch()}
        />
      )}

      {options && (
        <InfographicTopicPicker
          topics={options.topics}
          selected={effective.topicSlug}
          // Task numbers are per-topic, so a topic change always clears the task.
          onPick={(topicSlug) =>
            setSelection((cur) => ({ ...cur, topicSlug, taskNumber: null }))
          }
        />
      )}

      {selectedTopic?.vetted && (
        <InfographicTaskPicker
          topic={selectedTopic}
          selected={effective.taskNumber}
          onPick={(taskNumber) =>
            setSelection((cur) => ({ ...cur, taskNumber }))
          }
        />
      )}

      {options && options.styles.length > 0 && (
        <InfographicStylePicker
          styles={options.styles}
          selected={effective.styleId}
          onPick={(styleId) => setSelection((cur) => ({ ...cur, styleId }))}
        />
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="rounded-full border border-outline-variant px-6 py-2 text-sm font-semibold text-on-surface transition-colors duration-200 hover:bg-surface-container"
        >
          Back
        </button>
        <button
          onClick={() => plan && onNext(effective, plan)}
          disabled={!plan}
          className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-on-primary transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Review →
        </button>
      </div>
    </div>
  );
}

function CatalogLoadError({
  missing,
  message,
  retrying,
  onRetry,
}: {
  missing: boolean;
  message: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="mb-8 rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold">
            {missing ? "Topics are not available yet" : "Topics did not load"}
          </div>
          <p className="mt-1">
            {missing
              ? "The infographic topic catalog is not being served yet. Pick another format for now."
              : `The topic catalog request failed: ${message}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="shrink-0 rounded-full border border-current px-3 py-1 text-xs font-semibold disabled:opacity-50"
        >
          {retrying ? "Retrying…" : "Try again"}
        </button>
      </div>
    </div>
  );
}
