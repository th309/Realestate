"use client";

import type { InfographicTopic } from "../lib/infographic-options-api";

/**
 * The single-task picker — the surface where the one-task-per-graphic rule is
 * enforced. The numbers shown are the topic doc's own section numbers, and the
 * same value travels in the run params, so a finished graphic can be traced
 * back to the section it came from.
 */
export function InfographicTaskPicker({
  topic,
  selected,
  onPick,
}: {
  topic: InfographicTopic;
  selected: number | null;
  onPick: (taskNumber: number) => void;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold mb-2">Which task?</h2>
      {topic.tasks.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          This topic doc has no numbered tasks yet.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-on-surface-variant">
            Numbers match the task sections in the topic doc.
          </p>
          <div
            className="overflow-hidden rounded-xl border border-outline-variant"
            role="radiogroup"
            aria-label="Task"
          >
            {topic.tasks.map((task) => {
              const active = selected === task.number;
              return (
                <label
                  key={task.number}
                  className={`flex cursor-pointer items-start gap-3 border-b border-outline-variant px-4 py-3 text-sm transition-colors duration-200 last:border-b-0 ${
                    active
                      ? "bg-primary-container text-on-primary-container"
                      : "bg-surface hover:bg-surface-container-low"
                  }`}
                >
                  <input
                    type="radio"
                    name="infographic-task"
                    value={task.number}
                    checked={active}
                    onChange={() => onPick(task.number)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={`pt-0.5 font-mono text-xs tabular-nums ${
                      active ? "opacity-80" : "text-on-surface-variant"
                    }`}
                  >
                    {String(task.number).padStart(2, "0")}
                  </span>
                  <span className="flex-1">{task.label}</span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
