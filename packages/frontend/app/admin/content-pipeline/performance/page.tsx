"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  fetchPerformanceOverview,
  fetchPerformanceRuns,
  type FormatConversionRow,
  type PerformanceHeroCard,
  type PerformanceRunRow,
} from "../lib/performance-api";

const OVERVIEW_KEY = ["content-pipeline-performance-overview"] as const;
const RUNS_KEY = ["content-pipeline-performance-runs"] as const;

export default function PerformancePage() {
  const sinceDays = 30;
  const overview = useQuery({
    queryKey: [...OVERVIEW_KEY, sinceDays],
    queryFn: () => fetchPerformanceOverview({ sinceDays }),
  });
  const runs = useQuery({
    queryKey: [...RUNS_KEY, sinceDays],
    queryFn: () =>
      fetchPerformanceRuns({ sinceDays, sort: "created_at", dir: "desc", limit: 50 }),
  });

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="p-8 max-w-6xl space-y-6">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-on-surface">Performance</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              7d views/signups + attributed MRR rollups. Window: last {sinceDays} days.
            </p>
          </div>
        </header>

        {overview.isLoading ? (
          <Skeleton />
        ) : overview.error || !overview.data ? (
          <ErrorCard />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <HeroCard hero={overview.data.hero} />
            <SuggestedRunsCard items={overview.data.suggestedRuns} />
            <HookPatternsCard rows={overview.data.hookPatterns} />
          </div>
        )}

        {overview.data && (
          <FormatConversionPanel rows={overview.data.formatConversion} />
        )}

        <RunsTable rows={runs.data ?? []} loading={runs.isLoading} />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-40 rounded-xl bg-surface-container-low animate-pulse"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

function ErrorCard() {
  return (
    <div className="rounded-xl bg-error-container text-on-error-container px-4 py-3 text-sm">
      Couldn&apos;t load performance data. Refresh to retry.
    </div>
  );
}

function HeroCard({ hero }: { hero: PerformanceHeroCard }) {
  const fmt = (n: number | null, kind: "int" | "usd" = "int") => {
    if (n == null || Number.isNaN(n)) return "—";
    if (kind === "usd") return `$${Math.round(n).toLocaleString()}`;
    return Math.round(n).toLocaleString();
  };
  return (
    <div className="rounded-xl bg-surface-container-low p-5 shadow-sm">
      <div className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant">
        Hero (last {hero.sinceDays}d)
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Metric label="Published runs" value={fmt(hero.publishedRuns)} />
        <Metric label="Avg views (7d)" value={fmt(hero.avgViews7d)} />
        <Metric label="Avg signups (7d)" value={fmt(hero.avgSignups7d)} />
        <Metric label="Avg MRR (7d)" value={fmt(hero.avgMrr7dUsd, "usd")} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-2 border border-outline-variant">
      <div className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">
        {label}
      </div>
      <div className="text-lg font-semibold text-on-surface mt-0.5">{value}</div>
    </div>
  );
}

function SuggestedRunsCard({ items }: { items: any[] }) {
  return (
    <div className="rounded-xl bg-surface-container-low p-5 shadow-sm">
      <div className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant">
        Suggested runs
      </div>
      <div className="mt-3 space-y-2">
        {(items ?? []).slice(0, 4).map((s: any, idx: number) => (
          <div key={idx} className="rounded-lg bg-surface px-3 py-2 border border-outline-variant">
            <div className="text-sm font-medium text-on-surface">{s.title}</div>
            <div className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{s.reason}</div>
          </div>
        ))}
        <Link
          href="/admin/content-pipeline/new"
          className="inline-flex text-xs font-medium text-primary hover:underline mt-1"
        >
          Create a run →
        </Link>
      </div>
    </div>
  );
}

function HookPatternsCard({ rows }: { rows: any[] }) {
  return (
    <div className="rounded-xl bg-surface-container-low p-5 shadow-sm">
      <div className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant">
        Hook winners
      </div>
      <div className="mt-3 space-y-2">
        {(rows ?? []).length === 0 ? (
          <div className="text-sm text-on-surface-variant">No promotions yet.</div>
        ) : (
          (rows ?? []).slice(0, 6).map((r: any) => (
            <div
              key={r.format}
              className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 border border-outline-variant"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-on-surface truncate">{r.format}</div>
                <div className="text-[11px] text-on-surface-variant">
                  promoted {r.winnerVariantId} · lift {(Number(r.lift) * 100).toFixed(0)}% ·{" "}
                  {(Number(r.confidence) * 100).toFixed(1)}%
                </div>
              </div>
              <div className="text-xs font-mono text-on-surface-variant">
                {r.lastPromotedAt ? new Date(r.lastPromotedAt).toLocaleDateString() : "—"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FormatConversionPanel({ rows }: { rows: FormatConversionRow[] }) {
  return (
    <section className="rounded-xl bg-surface-container-low shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant">
            Format conversion
          </div>
          <div className="text-sm text-on-surface-variant mt-1">
            Rollup of runs → posts → views → signups → attributed MRR.
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Format</th>
              <th className="px-4 py-3 font-medium">Runs</th>
              <th className="px-4 py-3 font-medium">Posts</th>
              <th className="px-4 py-3 font-medium">Views (7d)</th>
              <th className="px-4 py-3 font-medium">Signups (7d)</th>
              <th className="px-4 py-3 font-medium">MRR (7d)</th>
              <th className="px-4 py-3 font-medium">Signups / 1k views</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.format} className="border-t border-outline-variant text-on-surface">
                <td className="px-4 py-3 font-medium">{r.format}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.runs}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.posts}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.views7d.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.signups7d.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs">${Math.round(r.mrr7dUsd).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {r.signupsPer1kViews == null ? "—" : r.signupsPer1kViews.toFixed(2)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-on-surface-variant" colSpan={7}>
                  No runs in window.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RunsTable({ rows, loading }: { rows: PerformanceRunRow[]; loading: boolean }) {
  return (
    <section className="rounded-xl bg-surface-container-low shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-outline-variant">
        <div className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant">
          Runs
        </div>
        <div className="text-sm text-on-surface-variant mt-1">
          Click a run to inspect full assets, gates, and per-platform posts.
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Format</th>
              <th className="px-4 py-3 font-medium">Market</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Platforms</th>
              <th className="px-4 py-3 font-medium">Views (7d)</th>
              <th className="px-4 py-3 font-medium">Signups (7d)</th>
              <th className="px-4 py-3 font-medium">MRR (7d)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-on-surface-variant" colSpan={8}>
                  Loading…
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-outline-variant text-on-surface">
                  <td className="px-4 py-3 font-mono text-xs">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.format}</td>
                  <td className="px-4 py-3 text-on-surface-variant max-w-[22rem] truncate">
                    <Link href={`/admin/content-pipeline/runs/${r.id}`} className="hover:underline">
                      {r.market_query}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.status}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">
                    {(r.platforms ?? []).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.views_7d.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.signups_7d.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    ${Math.round(r.mrr_7d_usd).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-on-surface-variant" colSpan={8}>
                  No runs in window.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

