/**
 * Status Badge for Test Runner
 *
 * Displays the current status of a test job with appropriate
 * styling, animations, and contextual information.
 */

import type { TestJob } from "./test-runner-config";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    cls: "bg-surface-container text-on-surface-variant",
  },
  switching: {
    label: "Switching model...",
    cls: "bg-amber-100 text-amber-800",
  },
  generating: { label: "Generating...", cls: "bg-blue-100 text-blue-800" },
  polling: { label: "Generating", cls: "bg-blue-100 text-blue-800" },
  done: { label: "Done", cls: "bg-green-100 text-green-800" },
  error: { label: "Error", cls: "bg-red-100 text-red-800" },
} as const;

export function StatusBadge({
  status,
  error,
  elapsed,
  stage,
}: Pick<TestJob, "status" | "error" | "elapsed" | "stage">) {
  const config = STATUS_CONFIG[status];

  if (status === "error" && error) {
    return (
      <span
        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${config.cls}`}
      >{`Error: ${error}`}</span>
    );
  }

  if (status === "polling") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.cls}`}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        {elapsed || "0s"}
        {stage ? ` — ${stage}` : ""}
      </span>
    );
  }

  if (status === "switching" || status === "generating") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.cls}`}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        {config.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${config.cls}`}
    >
      {config.label}
    </span>
  );
}
