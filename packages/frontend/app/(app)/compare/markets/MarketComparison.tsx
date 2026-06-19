"use client";

import { useEffect, useState } from "react";
import {
  fetchPeers,
  useScoreData,
  useDataCard,
  type PeerCandidate,
} from "@/lib/data";
import { getScoreLabel } from "@/app/components/scoring/ScoreDisplay";
import { PeerSearchBox, type PickedMarket } from "./PeerSearchBox";

export interface CompareSource {
  geoLevel: string;
  geoId: string;
}

/**
 * Side-by-side market comparison: the chosen source market against its
 * auto-suggested closest peer, with a search to swap in any other market.
 * Source-agnostic so it can mount on the /compare/markets route (source from
 * the URL) or inline in the Explore Markets page (source picked in-page).
 */
export function MarketComparison({ source }: { source: CompareSource }) {
  // The closest peer the backend suggests, and an optional user override. The
  // override wins so the side-by-side updates the instant a market is picked.
  const [autoPeer, setAutoPeer] = useState<PeerCandidate | null>(null);
  const [manualPeer, setManualPeer] = useState<PickedMarket | null>(null);
  const [loadingPeer, setLoadingPeer] = useState(true);

  useEffect(() => {
    setManualPeer(null); // a new source market invalidates a prior override
    setAutoPeer(null); // clear the old peer so it doesn't flash during refetch
    setLoadingPeer(true);
    fetchPeers(source.geoLevel, source.geoId)
      .then((res) => setAutoPeer(res.peers[0] ?? null))
      .catch(() => setAutoPeer(null))
      .finally(() => setLoadingPeer(false));
  }, [source.geoLevel, source.geoId]);

  const peer = manualPeer ?? autoPeer;

  return (
    <div>
      <div className="mx-auto mb-6 max-w-md">
        <PeerSearchBox
          placeholder="🔍  Compare against another market"
          onPick={setManualPeer}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr]">
        <ComparisonSide
          geoLevel={source.geoLevel}
          geoId={source.geoId}
          isSource
        />
        <div className="flex items-center justify-center text-sm font-semibold text-on-surface-variant">
          VS
        </div>
        {loadingPeer && !peer ? (
          <div className="flex items-center justify-center rounded-2xl border border-outline-variant bg-surface-container p-5 text-center text-sm text-on-surface-variant">
            Finding closest peer…
          </div>
        ) : peer ? (
          <ComparisonSide geoLevel={peer.geoLevel} geoId={peer.geoId} />
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-outline-variant bg-surface-container p-5 text-center text-sm text-on-surface-variant">
            No peer found nearby — search above to pick any market.
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonSide({
  geoLevel,
  geoId,
  isSource,
}: {
  geoLevel: string;
  geoId: string;
  isSource?: boolean;
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
    "days_on_market",
    geoLevel as Parameters<typeof useDataCard>[1],
    geoId,
  );
  const trend = useDataCard(
    "home_value_yoy",
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
        isSource
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
