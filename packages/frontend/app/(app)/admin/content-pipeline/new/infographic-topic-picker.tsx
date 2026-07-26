"use client";

import type { InfographicTopic } from "../lib/infographic-options-api";

/**
 * Topic cards for the infographic step.
 *
 * Draft topics are listed but not selectable — an unvetted doc has not been
 * fact-checked, and a generated graphic inherits whatever its source doc says.
 * Showing them (rather than hiding them) tells the operator the topic exists
 * and what it is waiting on.
 */
export function InfographicTopicPicker({
  topics,
  selected,
  onPick,
}: {
  topics: InfographicTopic[];
  selected: string;
  onPick: (slug: string) => void;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold mb-2">Which topic?</h2>
      {topics.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          No topic docs yet. Add one to the infographic topic library to
          generate from it.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {topics.map((topic) => (
            <TopicCard
              key={topic.slug}
              topic={topic}
              active={selected === topic.slug}
              onPick={() => onPick(topic.slug)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TopicCard({
  topic,
  active,
  onPick,
}: {
  topic: InfographicTopic;
  active: boolean;
  onPick: () => void;
}) {
  const taskCount = topic.tasks.length;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!topic.vetted}
      aria-pressed={active}
      title={
        topic.vetted
          ? undefined
          : "This topic doc is still a draft and has not been vetted"
      }
      className={`w-[220px] rounded-xl border p-4 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        !topic.vetted
          ? "border-outline-variant bg-surface-container-low opacity-60 cursor-not-allowed"
          : active
            ? "border-primary bg-primary-container text-on-primary-container"
            : "border-outline-variant bg-surface hover:bg-surface-container-low"
      }`}
    >
      <div className="text-sm font-semibold">{topic.title}</div>
      {topic.vetted ? (
        <div className="mt-1 text-xs text-on-surface-variant">
          {taskCount} task{taskCount === 1 ? "" : "s"} · one per graphic
        </div>
      ) : (
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-outline-variant"
          />
          Pending vetting
        </span>
      )}
    </button>
  );
}
