"use client";
import { useQuery } from "@tanstack/react-query";
import { GEOJSON_SOURCES, getGeoJsonApiUrl } from "@/lib/data";
import { fetchWithRetry } from "@/app/(app)/map/utils/geojson-fetch";
import {
  computeBbox,
  mergeBbox,
  toSvgPath,
  makeProjection,
  type GeoJSONGeometry,
} from "./geo-projection";

export interface BoundaryFeature {
  id: string;
  path: string;
}
export interface GeoBoundaries {
  parentOutline: string | null;
  viewBoxWidth: number;
  viewBoxHeight: number;
  features: BoundaryFeature[];
  isLoading: boolean;
  error: Error | null;
}

interface RawFeature {
  type: "Feature";
  properties: Record<string, any>;
  geometry: GeoJSONGeometry;
}
interface RawFeatureCollection {
  type: "FeatureCollection";
  features: RawFeature[];
}

/**
 * AK, HI, and US territories — excluded from the equirectangular contiguous-US
 * projection; not renderable in Map view at this scope (known MVP limit,
 * still reachable via Bubbles view or search).
 * Verified live against public/geojson/states.json (56 features, 2026-07-15):
 * 02=AK, 15=HI, 60=American Samoa, 66=Guam, 69=N. Mariana Islands, 72=PR,
 * 78=US Virgin Islands. The brief's original AK/HI/PR-only set left the three
 * Pacific/Caribbean territories in the "contiguous" merge, which would blow
 * out the bbox across the antimeridian and wreck the national projection.
 */
const EXCLUDED_STATE_FIPS = new Set(["02", "15", "60", "66", "69", "72", "78"]);
const SIZE = 900;
const EMPTY: Omit<GeoBoundaries, "isLoading" | "error"> = {
  parentOutline: null,
  viewBoxWidth: 0,
  viewBoxHeight: 0,
  features: [],
};

async function fetchStaticGeojson(url: string): Promise<RawFeatureCollection> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

function isContiguous(f: RawFeature): boolean {
  return !EXCLUDED_STATE_FIPS.has(f.properties.STATEFP);
}

async function buildBoundaries(
  geoLevel: "state" | "metro" | "county" | "zip",
  parentLevel: "state" | "metro" | "county" | undefined,
  parentId: string | undefined,
  parentState: string | undefined,
  regionIds: string[] | undefined,
): Promise<Omit<GeoBoundaries, "isLoading" | "error">> {
  if (geoLevel === "state") {
    const states = await fetchStaticGeojson("/geojson/states.json");
    const contiguous = states.features.filter(isContiguous);
    const bbox = mergeBbox(contiguous.map((f) => computeBbox(f.geometry)));
    const { project, width, height } = makeProjection(bbox, SIZE);
    return {
      parentOutline: null,
      viewBoxWidth: width,
      viewBoxHeight: height,
      features: contiguous.map((f) => ({
        id: f.properties.STATEFP,
        path: toSvgPath(f.geometry, project),
      })),
    };
  }

  if (geoLevel === "metro" && !parentId) {
    const [states, metros] = await Promise.all([
      fetchStaticGeojson("/geojson/states.json"),
      fetchStaticGeojson("/geojson/metros.json"),
    ]);
    const contiguousStates = states.features.filter(isContiguous);
    const bbox = mergeBbox(
      contiguousStates.map((f) => computeBbox(f.geometry)),
    );
    const { project, width, height } = makeProjection(bbox, SIZE);
    const parentOutline = contiguousStates
      .map((f) => toSvgPath(f.geometry, project))
      .join(" ");
    // National roster is the ~935-region uncapped set from the backend (Task 1) —
    // no regionIds filter needed here since the whole metros.json IS the roster.
    return {
      parentOutline,
      viewBoxWidth: width,
      viewBoxHeight: height,
      features: metros.features.map((f) => ({
        id: f.properties.CBSAFP,
        path: toSvgPath(f.geometry, project),
      })),
    };
  }

  if (geoLevel === "metro" && parentLevel === "state") {
    const [states, metros] = await Promise.all([
      fetchStaticGeojson("/geojson/states.json"),
      fetchStaticGeojson("/geojson/metros.json"),
    ]);
    const stateFeature = states.features.find(
      (f) => f.properties.STATEFP === parentId,
    );
    if (!stateFeature) return EMPTY;
    const { project, width, height } = makeProjection(
      computeBbox(stateFeature.geometry),
      SIZE,
    );
    // metros.json has no direct state-FIPS field; NAME reliably ends in the
    // state abbreviation (e.g. "Dallas-Fort Worth-Arlington, TX"), including
    // cross-state CBSAs like "Texarkana, TX-AR" — validated against the live
    // backend during design (Texas: 50 real metro/micro regions returned).
    const abbr = stateFeature.properties.STUSPS;
    const stateMetroRegex = new RegExp(`,\\s*${abbr}(-|$)`);
    return {
      parentOutline: toSvgPath(stateFeature.geometry, project),
      viewBoxWidth: width,
      viewBoxHeight: height,
      features: metros.features
        .filter((f) => stateMetroRegex.test(f.properties.NAME))
        .map((f) => ({
          id: f.properties.CBSAFP,
          path: toSvgPath(f.geometry, project),
        })),
    };
  }

  if (geoLevel === "county" && parentLevel === "metro") {
    const [metros, counties] = await Promise.all([
      fetchStaticGeojson("/geojson/metros.json"),
      fetchStaticGeojson("/geojson/counties.json"),
    ]);
    const metroFeature = metros.features.find(
      (f) => f.properties.CBSAFP === parentId,
    );
    if (!metroFeature) return EMPTY;
    const { project, width, height } = makeProjection(
      computeBbox(metroFeature.geometry),
      SIZE,
    );
    // counties.json is a NATIONAL file (~3,143 features) — pre-filter by
    // regionIds when given, unlike the metro tier above, to avoid mapping
    // thousands of irrelevant paths.
    const countyFeatures = regionIds
      ? counties.features.filter((f) => regionIds.includes(f.properties.id))
      : counties.features;
    return {
      parentOutline: toSvgPath(metroFeature.geometry, project),
      viewBoxWidth: width,
      viewBoxHeight: height,
      features: countyFeatures.map((f) => ({
        id: f.properties.id,
        path: toSvgPath(f.geometry, project),
      })),
    };
  }

  if (geoLevel === "zip" && parentLevel === "county") {
    if (!parentId || !parentState) return EMPTY;
    const [counties, zipsRes] = await Promise.all([
      fetchStaticGeojson("/geojson/counties.json"),
      fetchWithRetry(
        getGeoJsonApiUrl(`${GEOJSON_SOURCES.zip}/${parentState.toUpperCase()}`),
      ),
    ]);
    const countyFeature = counties.features.find(
      (f) => f.properties.id === parentId,
    );
    if (!countyFeature) return EMPTY;
    const zips: RawFeatureCollection = await zipsRes.json();
    const { project, width, height } = makeProjection(
      computeBbox(countyFeature.geometry),
      SIZE,
    );
    // ZIP-tier regionIds is REQUIRED (not optional) — the backend endpoint
    // returns every ZIP in the state, easily hundreds; this is the
    // ZIP_FETCH_CAP=70-capped roster from Task 1, not the full state.
    // Verified live against GET /api/geography/zips/TX (2026-07-15): the ZIP
    // code lives in `ZCTA5CE20` (1,985 TX features returned).
    const zipId = (f: RawFeature) => f.properties.ZCTA5CE20;
    const zipFeatures = regionIds
      ? zips.features.filter((f) => regionIds.includes(zipId(f)))
      : zips.features;
    return {
      parentOutline: toSvgPath(countyFeature.geometry, project),
      viewBoxWidth: width,
      viewBoxHeight: height,
      features: zipFeatures.map((f) => ({
        id: zipId(f),
        path: toSvgPath(f.geometry, project),
      })),
    };
  }

  return EMPTY;
}

export function useGeoBoundaries(
  geoLevel: "state" | "metro" | "county" | "zip",
  parentLevel: "state" | "metro" | "county" | undefined,
  parentId: string | undefined,
  parentState: string | undefined,
  regionIds?: string[],
): GeoBoundaries {
  const query = useQuery({
    queryKey: [
      "geo-boundaries",
      geoLevel,
      parentLevel ?? null,
      parentId ?? null,
      parentState ?? null,
      regionIds?.join(",") ?? null,
    ],
    queryFn: () =>
      buildBoundaries(geoLevel, parentLevel, parentId, parentState, regionIds),
    staleTime: 2 * 60 * 60 * 1000, // 2h, matches this app's data-layer convention (CLAUDE.md §5)
    gcTime: 2 * 60 * 60 * 1000,
  });

  return {
    parentOutline: query.data?.parentOutline ?? null,
    viewBoxWidth: query.data?.viewBoxWidth ?? 0,
    viewBoxHeight: query.data?.viewBoxHeight ?? 0,
    features: query.data?.features ?? [],
    isLoading: query.isLoading,
    error: (query.error as Error | undefined) ?? null,
  };
}
