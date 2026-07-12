/**
 * Leader-line + callout label setup for small states at the state geo level.
 * Extracted from useMapLayers to keep the hook under the file-size limit —
 * pure relocation, no behavior change.
 */
import type { MutableRefObject } from "react";
import mapboxgl from "mapbox-gl";
import type { MetricFormat } from "./metricUtils";
import type { LabelFeature } from "./label-layout";
import type { MarkerStore } from "./callout-markers";
import { computeScreenSpaceRatios } from "./screen-space-detection";
import {
  computeCalloutPositions,
  buildLeaderLineGeojson,
} from "./label-layout";
import { syncCalloutMarkers, updateCalloutOpacity } from "./callout-markers";
import { addLeaderLineLayers } from "./leader-line-layers";
import { computeFillColor } from "./map-layer-config";

export interface SetupStateLabelCalloutsParams {
  map: MutableRefObject<mapboxgl.Map | null>;
  labelPointsGeojson: any;
  minVal: number;
  maxVal: number;
  metricFormat: MetricFormat;
  markersRef: MutableRefObject<MarkerStore>;
  zoomHandlerRef: MutableRefObject<(() => void) | null>;
}

/**
 * Builds callout label features for small states whose labels can't fit
 * inside their own borders, then wires up leader lines + pill markers and
 * keeps them in sync on zoom. Called only when geoLevel === "state".
 */
export function setupStateLabelCallouts({
  map,
  labelPointsGeojson,
  minVal,
  maxVal,
  metricFormat,
  markersRef,
  zoomHandlerRef,
}: SetupStateLabelCalloutsParams): void {
  // Build LabelFeature array from the label points
  const labelFeatures: LabelFeature[] = labelPointsGeojson.features.map(
    (f: any) => ({
      name: f.properties.name,
      value: f.properties.value,
      polylabel: [f.properties.polylabelLng, f.properties.polylabelLat] as [
        number,
        number,
      ],
      bbox: [
        f.properties.bboxMinLng,
        f.properties.bboxMinLat,
        f.properties.bboxMaxLng,
        f.properties.bboxMaxLat,
      ] as [number, number, number, number],
      screenSpaceRatio: 0,
      fillColor: "",
    }),
  );

  // Compute fill colors for each state (matching geo-fills)
  for (const lf of labelFeatures) {
    lf.fillColor = computeFillColor(lf.value, minVal, maxVal);
  }

  // Function to update labels on zoom
  const updateLabelsForZoom = () => {
    if (!map.current) return;

    computeScreenSpaceRatios(labelFeatures, map.current);

    const source = map.current.getSource("geo-labels-data") as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (source) {
      const updatedData = {
        ...labelPointsGeojson,
        features: labelPointsGeojson.features.map((f: any, i: number) => ({
          ...f,
          properties: {
            ...f.properties,
            screenSpaceRatio: labelFeatures[i]?.screenSpaceRatio ?? 0,
          },
        })),
      };
      source.setData(updatedData);
    }

    const callouts = computeCalloutPositions(labelFeatures, map.current);
    const lineGeojson = buildLeaderLineGeojson(callouts);

    addLeaderLineLayers(map.current, lineGeojson);
    syncCalloutMarkers(markersRef.current, map.current, callouts, metricFormat);
    updateCalloutOpacity(markersRef.current, labelFeatures);
  };

  updateLabelsForZoom();
  map.current!.on("zoomend", updateLabelsForZoom);
  zoomHandlerRef.current = updateLabelsForZoom;
}
