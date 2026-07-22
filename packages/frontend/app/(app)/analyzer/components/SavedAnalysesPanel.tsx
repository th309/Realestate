"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, ChevronDown, ChevronUp } from "lucide-react";
import { fetchSavedAnalyses, type SavedAnalysis } from "@/lib/data";
import { resolveSavedAnalysisLabel } from "../lib/format-helpers";

/**
 * Entry point for a user's saved analyses inside /analyzer. Renders nothing
 * until at least one saved analysis exists, so first-run users see no clutter.
 * Each row links to /analyzer/saved/[id].
 */
export function SavedAnalysesPanel() {
  const [saved, setSaved] = useState<SavedAnalysis[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSavedAnalyses()
      .then((rows) => {
        if (!cancelled) setSaved(rows);
      })
      .catch(() => {
        if (!cancelled) setSaved([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (saved.length === 0) return null;

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-low">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-on-surface"
      >
        <span className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-primary" />
          Saved analyses ({saved.length})
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-on-surface-variant" />
        ) : (
          <ChevronDown className="h-4 w-4 text-on-surface-variant" />
        )}
      </button>

      {expanded && (
        <ul className="divide-y divide-outline-variant border-t border-outline-variant">
          {saved.map((row) => (
            <li key={row.id}>
              <Link
                href={`/analyzer/saved/${row.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-container"
              >
                <span className="min-w-0 truncate text-sm text-on-surface">
                  {resolveSavedAnalysisLabel(row)}
                </span>
                <span className="shrink-0 text-xs text-on-surface-variant">
                  {new Date(row.created_at).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
