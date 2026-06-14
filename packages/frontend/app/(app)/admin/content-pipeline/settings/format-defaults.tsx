"use client";
import { useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { FormatRow, type FormatRowData } from "./format-row";

/**
 * Section component for the Settings page. Wraps the format rows with
 * single-expansion state (only one row open at a time) and a per-row
 * "saving" indicator driven by the global useIsMutating count.
 */
export function FormatDefaults({ formats }: { formats: FormatRowData[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const mutatingCount = useIsMutating({
    predicate: (m) =>
      Array.isArray(m.options.mutationKey) === false ||
      m.state.status === "pending",
  });
  const anySaving = mutatingCount > 0;

  if (formats.length === 0) {
    return (
      <div className="rounded-xl bg-surface-container-low px-6 py-8 text-center">
        <p className="text-sm text-on-surface mb-2">
          No format templates configured yet.
        </p>
        <p className="text-xs text-on-surface-variant">
          Run the content-pipeline seed migration to bootstrap the default 8
          formats.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-container-low overflow-hidden shadow-sm">
      {formats.map((f) => (
        <FormatRow
          key={f.format}
          row={f}
          expanded={expanded === f.format}
          onExpand={() =>
            setExpanded((cur) => (cur === f.format ? null : f.format))
          }
          // Saving is approximate (any mutation is in flight). Rather than
          // tracking per-row, this surfaces "the page is busy" without
          // mis-attributing a slow save to the wrong row.
          saving={anySaving && expanded === f.format}
        />
      ))}
    </div>
  );
}
