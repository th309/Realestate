"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchArchetypes,
  fetchRefreshRuns,
  triggerArchetypeRefresh,
  updateArchetype,
  type ScriptArchetype,
} from "../lib/archetypes-api";
import { useToast } from "../lib/toast";
import { M3Switch } from "../components/m3-switch";

const QUERY_KEY = ["content-pipeline-archetypes"] as const;
const RUNS_KEY = ["content-pipeline-archetype-runs"] as const;

export default function ArchetypeLibraryPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<string>("");

  const { data: archetypes = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEY, filter],
    queryFn: () => fetchArchetypes(filter || undefined),
  });

  const { data: runs = [] } = useQuery({
    queryKey: RUNS_KEY,
    queryFn: fetchRefreshRuns,
    refetchInterval: 15_000,
  });

  const refreshMut = useMutation({
    mutationFn: triggerArchetypeRefresh,
    onSuccess: () => {
      toast.info(
        "Refresh queued — check back in 5-15 min for new clusters and archetypes",
      );
      qc.invalidateQueries({ queryKey: RUNS_KEY });
    },
    onError: (err: Error) =>
      toast.error(`Refresh failed: ${err.message.slice(0, 100)}`),
  });

  const toggleMut = useMutation({
    mutationFn: ({ slug, enabled }: { slug: string; enabled: boolean }) =>
      updateArchetype(slug, { enabled }),
    onMutate: async ({ slug, enabled }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const previous = qc.getQueryData([...QUERY_KEY, filter]);
      qc.setQueryData(
        [...QUERY_KEY, filter],
        (old: ScriptArchetype[] | undefined) =>
          old?.map((a) => (a.slug === slug ? { ...a, enabled } : a)),
      );
      return { previous };
    },
    onError: (err: Error, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData([...QUERY_KEY, filter], ctx.previous);
      toast.error(`Save failed: ${err.message.slice(0, 100)}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const lastRun = runs[0];

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">
            Script Archetypes
          </h1>
          <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
            Discovered patterns from top-performing real estate videos. Each
            archetype captures a hook+body+CTA structure that works for a given
            format. The router (Task 2.33 stub) picks one per run.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refreshMut.mutate()}
          disabled={refreshMut.isPending}
          className="bg-primary text-on-primary rounded-full px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors duration-200"
        >
          Refresh now
        </button>
      </header>

      {lastRun && (
        <div className="rounded-xl bg-surface-container-low p-4 text-xs text-on-surface-variant flex flex-wrap gap-x-6 gap-y-1">
          <span>
            <strong>Last refresh:</strong>{" "}
            {new Date(lastRun.started_at).toLocaleString()}
          </span>
          <span>
            <strong>Status:</strong>{" "}
            <span
              className={
                lastRun.status === "succeeded"
                  ? "text-tertiary"
                  : lastRun.status === "failed"
                    ? "text-error"
                    : "text-primary"
              }
            >
              {lastRun.status}
            </span>
          </span>
          <span>{lastRun.videos_discovered} videos</span>
          <span>{lastRun.transcripts_fetched} transcripts</span>
          <span>{lastRun.clusters_built} clusters</span>
          <span>{lastRun.archetypes_promoted} promoted</span>
          <span>${lastRun.total_cost_usd?.toFixed(4) ?? "0"}</span>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <FilterChip
          label="All"
          active={filter === ""}
          onClick={() => setFilter("")}
        />
        {[
          "grade_reveal",
          "top_10_ranking",
          "score_mover",
          "head_to_head",
          "long_form_deep_dive",
          "farm_area_spotlight",
        ].map((f) => (
          <FilterChip
            key={f}
            label={f}
            active={filter === f}
            onClick={() => setFilter(filter === f ? "" : f)}
          />
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-44 bg-surface-container-low rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : archetypes.length === 0 ? (
        <div className="rounded-xl bg-surface-container-low px-6 py-10 text-center">
          <p className="text-sm text-on-surface mb-2">No archetypes yet.</p>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto">
            Run a refresh to populate from YouTube discovery + clustering.
            Requires <code>YOUTUBE_DATA_API_KEY</code>,{" "}
            <code>OPENAI_API_KEY</code>, and yt-dlp on the runtime PATH.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {archetypes.map((a) => (
            <ArchetypeCard
              key={a.slug}
              archetype={a}
              onToggle={(enabled) =>
                toggleMut.mutate({ slug: a.slug, enabled })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-200 ${
        active
          ? "bg-secondary-container text-on-secondary-container border-transparent"
          : "bg-surface text-on-surface border-outline hover:bg-surface-container-low"
      }`}
    >
      {label}
    </button>
  );
}

function ArchetypeCard({
  archetype,
  onToggle,
}: {
  archetype: ScriptArchetype;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div
      className={`rounded-xl bg-surface-container-low p-5 shadow-sm transition-opacity duration-200 ${
        archetype.enabled ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="text-base font-semibold text-on-surface">
          {archetype.display_name}
        </h3>
        <M3Switch
          checked={archetype.enabled}
          ariaLabel={`Enable ${archetype.display_name}`}
          onChange={onToggle}
        />
      </div>
      <p className="text-xs text-on-surface-variant font-mono mb-2">
        {archetype.slug}
      </p>
      {archetype.description && (
        <p className="text-sm text-on-surface mb-3 line-clamp-2">
          {archetype.description}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {archetype.format_affinity.map((f) => (
          <span
            key={f}
            className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container"
          >
            {f}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
        <span>{archetype.member_count} examples</span>
        <span>
          median ~{(archetype.median_view_count ?? 0).toLocaleString()} views
        </span>
      </div>
      <details className="mt-3">
        <summary className="text-xs text-primary cursor-pointer hover:underline">
          View prompt template
        </summary>
        <pre className="mt-2 text-[11px] bg-surface-container p-3 rounded-lg whitespace-pre-wrap font-mono text-on-surface-variant max-h-48 overflow-y-auto">
          {archetype.prompt_template}
        </pre>
      </details>
    </div>
  );
}
