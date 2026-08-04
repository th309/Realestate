"use client";

import type { GeoLevel, ForecastHorizon, MapData } from "./types";
import {
  Legend,
  DataTableModal,
  type ScoreViewMode,
} from "./components";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

interface MapCanvasProps {
  mapContainer: React.RefObject<HTMLDivElement | null>;
  mapError: string | null;
  effectiveDataLoading: boolean;
  effectiveMetric: string;
  selectedMetric: string;
  forecastHorizon: ForecastHorizon;
  geoLevel: GeoLevel;
  activeMapData: MapData;
  mapData: MapData;
  scoreViewMode: ScoreViewMode;
  showTableView: boolean;
  onShowTableView: (open: boolean) => void;
  /** True when the boundary (GeoJSON) fetch failed outright — distinct from
   * `mapError`, which is a fatal Mapbox instance load failure. */
  boundaryError: boolean;
  onRetryBoundary: () => void;
}

/**
 * The map viewport: the Mapbox container, loading/error overlays, the legend,
 * the Table View FAB, and the data-table modal. Pure presentational — the
 * Mapbox instance is owned by the page via the `mapContainer` ref.
 */
export function MapCanvas({
  mapContainer,
  mapError,
  effectiveDataLoading,
  effectiveMetric,
  selectedMetric,
  forecastHorizon,
  geoLevel,
  activeMapData,
  mapData,
  scoreViewMode,
  showTableView,
  onShowTableView,
  boundaryError,
  onRetryBoundary,
}: MapCanvasProps) {
  const isOnline = useOnlineStatus();

  return (
    <main className="flex min-h-0 flex-1 flex-col" data-tour="map-area">
      {/* Docked scale strip — was an absolutely positioned card floating over
          the Pacific, covering the geography it described. */}
      <Legend
        selectedMetric={effectiveMetric}
        forecastHorizon={forecastHorizon}
        geoLevel={geoLevel}
        mapData={activeMapData}
        overrideTitle={
          scoreViewMode === "match" ? "Market Match Score" : undefined
        }
      />

      <div className="relative min-h-0 flex-1">
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-error-container z-10">
            <p className="text-on-error-container font-medium">{mapError}</p>
          </div>
        )}
        {!mapError && boundaryError && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/95 z-10">
            <div className="text-center px-6">
              <p className="text-on-surface font-medium mb-4">
                {isOnline
                  ? "Couldn't load boundaries"
                  : "You're offline — showing saved data"}
              </p>
              <button
                onClick={onRetryBoundary}
                className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        )}
        {effectiveDataLoading && (
          <div className="absolute inset-0 z-10 animate-pulse bg-surface/80 p-4 flex flex-col">
            {/* Skeleton: map area */}
            <div className="flex-1 bg-surface-container-high rounded-xl" />
            {/* Skeleton: legend bar */}
            <div className="mt-3 h-10 w-64 bg-surface-container-high rounded-xl" />
          </div>
        )}
        <div
          ref={mapContainer}
          className="absolute inset-0"
          style={{ width: "100%", height: "100%" }}
        />

        {/* The Table View FAB that floated here moved into the control bar as
            a Map/Table segmented control — it was an orphan pill over the
            canvas, unrelated to anything around it. */}
      </div>

      {/* Data Table Modal */}
      <DataTableModal
        isOpen={showTableView}
        onClose={() => onShowTableView(false)}
        mapData={mapData}
        selectedMetric={selectedMetric}
        geoLevel={geoLevel}
        forecastHorizon={forecastHorizon}
      />
    </main>
  );
}
