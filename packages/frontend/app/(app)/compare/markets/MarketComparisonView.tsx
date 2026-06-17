"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  fetchPeers,
  useScoreData,
  useDataCard,
  type PeerCandidate,
} from "@/lib/data";
import { getScoreLabel } from "@/app/components/scoring/ScoreDisplay";

function parseMarket(
  raw: string | null,
): { geoLevel: string; geoId: string } | null {
  if (!raw) return null;
  const m = raw.match(/^([a-z]+)-(.+)$/);
  return m ? { geoLevel: m[1], geoId: m[2] } : null;
}

export function MarketComparisonView() {
  const sp = useSearchParams();
  const a = parseMarket(sp?.get("a") ?? sp?.get("market") ?? null);
  const [peer, setPeer] = useState<PeerCandidate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!a) {
      setLoading(false);
      return;
    }
    fetchPeers(a.geoLevel, a.geoId)
      .then((res) => setPeer(res.peers[0] ?? null))
      .catch(() => setPeer(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.geoLevel, a?.geoId]);

  if (!a) {
    return (
      <div className="p-8 text-center text-on-surface-variant">
        Pick a market first.
      </div>
    );
  }
  if (loading) {
    return (
      <div className="p-8 text-center text-on-surface-variant">
        Finding closest peer…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-on-surface">
          How your market stacks up
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Side-by-side against the closest peer market we could find.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr]">
        <ComparisonSide geoLevel={a.geoLevel} geoId={a.geoId} winner />
        <div className="flex items-center justify-center text-sm font-semibold text-on-surface-variant">
          VS
        </div>
        {peer ? (
          <ComparisonSide geoLevel={peer.geoLevel} geoId={peer.geoId} />
        ) : (
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-5 text-center text-sm text-on-surface-variant">
            No peer market available — your market is one-of-a-kind!
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonSide({
  geoLevel,
  geoId,
  winner,
}: {
  geoLevel: string;
  geoId: string;
  winner?: boolean;
}) {
  // Cast geoLevel to the data-layer type — the hooks accept GeoLevel, and
  // peers come from the same enum.
  const { data: score } = useScoreData(
    geoLevel as Parameters<typeof useScoreData>[0],
    geoId,
  );
  const price = useDataCard(
    "home_value",
    geoLevel as Parameters<typeof useDataCard>[1],
    geoId,
  );
  const dom = useDataCard(
    "dom_median",
    geoLevel as Parameters<typeof useDataCard>[1],
    geoId,
  );
  const trend = useDataCard(
    "zhvi_yoy",
    geoLevel as Parameters<typeof useDataCard>[1],
    geoId,
  );

  const scoreValue = score?.scores?.propertyiq?.score;
  const scoreLabel =
    typeof scoreValue === "number" ? getScoreLabel(scoreValue) : "—";

  return (
    <div
      className={[
        "rounded-2xl border p-5",
        winner
          ? "border-tertiary bg-gradient-to-b from-surface-container-lowest to-tertiary-container"
          : "border-outline-variant bg-surface-container-lowest",
      ].join(" ")}
    >
      <p className="text-sm font-semibold text-on-surface">
        {score?.location_name ?? `${geoLevel}/${geoId}`}
      </p>
      <p className="text-xs text-on-surface-variant">
        PropertyIQ {scoreValue ?? "—"} · {scoreLabel}
      </p>
      <dl className="mt-3 space-y-1.5 text-xs">
        <Stat label="Median price" value={price.formattedValue} />
        <Stat label="12-mo trend" value={trend.formattedValue} />
        <Stat label="Days on market" value={dom.formattedValue} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex justify-between border-b border-outline-variant/30 py-1 last:border-b-0">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="font-mono font-semibold text-on-surface">
        {value ?? "—"}
      </dd>
    </div>
  );
}
