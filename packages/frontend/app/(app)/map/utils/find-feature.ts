import type { Feature, FeatureCollection } from "geojson";
import { extractFeatureId } from "./map-interactions";

/** Find the feature in the loaded geo-data collection whose id matches the
 *  selection, using the SAME id extraction as the click handler. */
export function findFeatureById(
  fc: FeatureCollection | null,
  id: string,
): Feature | null {
  if (!fc) return null;
  for (const feature of fc.features) {
    const fid = extractFeatureId(
      (feature.properties as Record<string, unknown> | null) ?? {},
      typeof feature.id === "string" ? feature.id : undefined,
    );
    if (fid === id) return feature;
  }
  return null;
}
