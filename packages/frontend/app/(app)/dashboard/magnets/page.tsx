"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";

type DashboardMagnet = {
  id: string;
  magnet_kind: string;
  resolved_geo: { canonical_name?: string } | null;
  generated_at?: string | null;
  emailed_at?: string | null;
  display_name?: string | null;
  audience?: string | null;
  pdf_download_url?: string | null;
};

export default function DashboardMagnetsPage() {
  const { data = [], refetch, isLoading, error } = useQuery({
    queryKey: ["dashboard-magnets"],
    queryFn: async () =>
      (
        await fetchAPI<{
          success: boolean;
          data: { magnets: DashboardMagnet[] };
        }>("/api/dashboard/magnets")
      ).data.magnets,
  });

  async function refresh(magnet: DashboardMagnet) {
    await fetchAPIRaw("/api/dashboard/magnets/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        magnetKind: magnet.magnet_kind,
        geo: magnet.resolved_geo,
      }),
    });
    await refetch();
  }

  if (isLoading) {
    return (
      <main className="w-full max-w-4xl mx-auto p-8 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 bg-surface-container-low rounded-xl animate-pulse"
            style={{ animationDelay: `${i * 40}ms` }}
          />
        ))}
      </main>
    );
  }

  if (error) {
    return (
      <main className="w-full max-w-4xl mx-auto p-8">
        <div className="rounded-xl bg-error-container text-on-error-container px-4 py-3 text-sm">
          Couldn&apos;t load your magnets.{" "}
          <button
            type="button"
            onClick={() => refetch()}
            className="underline font-medium"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-4xl mx-auto p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-on-surface">
          Your Market Reports
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Download any report you&apos;ve received, or refresh it to regenerate
          with the latest data.
        </p>
      </header>

      {data.length === 0 && (
        <div className="rounded-xl bg-surface-container-low px-6 py-8 text-center text-sm text-on-surface-variant">
          You haven&apos;t received any reports yet.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map((m) => (
          <div
            key={m.id}
            className="rounded-xl bg-surface-container-low p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-on-surface truncate">
                  {m.display_name ?? m.magnet_kind}
                </h3>
                <p className="text-sm text-on-surface-variant truncate">
                  {m.resolved_geo?.canonical_name ?? "Unknown market"}
                </p>
              </div>
              {m.emailed_at ? (
                <span className="text-[11px] font-mono text-tertiary">
                  emailed
                </span>
              ) : (
                <span className="text-[11px] font-mono text-on-surface-variant">
                  in dashboard
                </span>
              )}
            </div>

            <p className="text-xs text-on-surface-variant mt-2">
              Generated{" "}
              {m.generated_at
                ? new Date(m.generated_at).toLocaleDateString()
                : "—"}
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              <a
                href={m.pdf_download_url ?? "#"}
                className={`text-sm rounded-full px-4 py-1.5 font-medium transition-colors duration-200 ${
                  m.pdf_download_url
                    ? "bg-primary text-on-primary hover:bg-primary/90"
                    : "bg-surface-container text-on-surface-variant cursor-not-allowed"
                }`}
                aria-disabled={!m.pdf_download_url}
              >
                Download PDF
              </a>
              <button
                type="button"
                onClick={() => refresh(m)}
                className="text-sm bg-surface-container text-on-surface rounded-full px-4 py-1.5 hover:bg-surface-container-high transition-colors duration-200"
              >
                Refresh data
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

