"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchEmbedMapData, type EmbedMapData } from "@/lib/data";
import {
  EmbedMiniMap,
  EmbedLoadingSkeleton,
  EmbedErrorState,
  type EmbedMapDataEntry,
} from "../../components";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: EmbedMapData };

/**
 * Embeddable Map Page
 *
 * Client component that fetches snapshot metric data via the embed
 * data endpoint and renders EmbedMiniMap with a choropleth layer.
 *
 * URL: /embed/map/:geoLevel?metric=home_value&token=emb_...&center=-96.8,32.7&zoom=6
 *
 * Query params:
 *   metric  — Metric ID to display (default: "home_value")
 *   token   — Embed token for auth + branding
 *   center  — Map center as "lng,lat" (default: US center)
 *   zoom    — Initial zoom level (default: 4)
 */
export default function EmbedMapPage() {
  const params = useParams<{ geoLevel: string }>();
  const searchParams = useSearchParams();

  const { geoLevel } = params;
  const token = searchParams.get("token") ?? "";
  const metric = searchParams.get("metric") ?? "home_value";
  const centerParam = searchParams.get("center");
  const zoomParam = searchParams.get("zoom");

  // Parse center from "lng,lat" string
  const center = parseCenterParam(centerParam);
  const zoom = zoomParam ? Number(zoomParam) : undefined;

  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!geoLevel) {
      setState({ status: "error", message: "Missing geography level" });
      return;
    }

    let cancelled = false;

    async function loadMapData() {
      setState({ status: "loading" });
      try {
        const data = await fetchEmbedMapData(geoLevel, metric, token);
        if (!cancelled) {
          setState({ status: "success", data });
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load map data";
          setState({ status: "error", message });
        }
      }
    }

    loadMapData();
    return () => {
      cancelled = true;
    };
  }, [geoLevel, metric, token]);

  if (state.status === "loading") {
    return <EmbedLoadingSkeleton />;
  }

  if (state.status === "error") {
    return <EmbedErrorState message={state.message} />;
  }

  // Transform API response to EmbedMapDataEntry format
  const mapEntries: EmbedMapDataEntry[] = state.data.data.map((region) => ({
    id: region.region_id,
    value: region.value,
    name: region.region_name,
  }));

  return (
    <div className="flex items-center justify-center p-2">
      <EmbedMiniMap
        geoLevel={geoLevel}
        metric={metric}
        center={center}
        zoom={zoom}
        data={mapEntries}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a "lng,lat" string into a [longitude, latitude] tuple.
 * Returns undefined if the string is missing or invalid.
 */
function parseCenterParam(param: string | null): [number, number] | undefined {
  if (!param) return undefined;

  const parts = param.split(",").map(Number);
  if (
    parts.length === 2 &&
    !Number.isNaN(parts[0]) &&
    !Number.isNaN(parts[1])
  ) {
    return [parts[0], parts[1]];
  }

  return undefined;
}
