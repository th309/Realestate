/**
 * GeoJSON feature enrichment: adds metric values to GeoJSON features from map data.
 * Extracted from useMapLayers to keep the hook focused on orchestration.
 */
import type { GeoLevel, MapData } from "../types";
import {
  FIPS_TO_STATE,
  STATE_NAME_TO_FIPS,
  getValueFromEntry,
  getDateFromEntry,
} from "../types";
import { normalizeZipKey } from "@/lib/format/zip";

/**
 * Enrich GeoJSON features with metric values from the map data store.
 * Mutates feature.properties in-place with value, dataDate, id, and displayName.
 *
 * @param zipNameLookup Optional zip code → display name map (e.g. "90210" → "Beverly Hills, CA 90210").
 *                      Only used when geoLevel is "zip".
 */
export function addValuesToFeatures(
  geojson: any,
  geoLevel: GeoLevel,
  mapData: MapData,
  zipNameLookup?: Record<string, string>,
): void {
  if (geoLevel === "national") {
    enrichNationalFeatures(geojson, mapData);
  } else if (geoLevel === "state") {
    enrichStateFeatures(geojson, mapData);
  } else if (geoLevel === "county") {
    enrichCountyFeatures(geojson, mapData);
  } else if (geoLevel === "metro") {
    enrichMetroFeatures(geojson, mapData);
  } else if (geoLevel === "city") {
    enrichCityFeatures(geojson, mapData);
  } else if (geoLevel === "zip") {
    enrichZipFeatures(geojson, mapData, zipNameLookup);
  } else if (geoLevel === "tract") {
    enrichTractFeatures(geojson, mapData);
  }
}

function enrichNationalFeatures(geojson: any, mapData: MapData): void {
  geojson.features.forEach((feature: any) => {
    const name =
      feature.properties.NAME || feature.properties.name || "United States";
    const entry = mapData["United States"] ?? mapData["US"] ?? mapData[name];
    feature.properties.value = getValueFromEntry(entry) || 0;
    feature.properties.dataDate = getDateFromEntry(entry);
    feature.properties.id = feature.properties.GEOID || "US";
    feature.properties.displayName = name;
    feature.properties.name = name;
  });
}

function enrichStateFeatures(geojson: any, mapData: MapData): void {
  geojson.features.forEach((feature: any) => {
    const name = feature.properties.name;
    // Try exact match first, then case-insensitive fallback (handles "District Of Columbia" vs "District of Columbia")
    const entry = mapData[name] ?? findCaseInsensitive(mapData, name);
    feature.properties.value = getValueFromEntry(entry) || 0;
    feature.properties.dataDate = getDateFromEntry(entry);
    const stateFips =
      feature.properties.STATEFP || STATE_NAME_TO_FIPS[name] || feature.id;
    feature.properties.id = stateFips;
    feature.properties.stateAbbr = FIPS_TO_STATE[stateFips] || "";
  });
}

function enrichCountyFeatures(geojson: any, mapData: MapData): void {
  let countyWithData = 0;
  geojson.features.forEach((feature: any) => {
    const fips = feature.id || feature.properties.id;
    const entry = mapData[fips] ?? mapData[String(parseInt(fips, 10))];
    feature.properties.value = getValueFromEntry(entry);
    feature.properties.dataDate = getDateFromEntry(entry);
    feature.properties.id = fips;
    if (getValueFromEntry(entry) != null) countyWithData++;
    const stateFips = fips?.substring(0, 2);
    const stateAbbr = FIPS_TO_STATE[stateFips] || "";
    feature.properties.displayName = `${feature.properties.NAME || "County"}, ${stateAbbr}`;
  });
  console.log(
    `[Map] County layer: ${geojson.features.length} features, ${Object.keys(mapData).length} data keys, ${countyWithData} features with value`,
  );
}

function enrichMetroFeatures(geojson: any, mapData: MapData): void {
  geojson.features.forEach((feature: any) => {
    const cbsaCode = feature.properties.CBSAFP || feature.properties.GEOID;
    const entry = mapData[cbsaCode];
    feature.properties.value = getValueFromEntry(entry);
    feature.properties.dataDate = getDateFromEntry(entry);
    feature.properties.id = cbsaCode;
    feature.properties.displayName =
      feature.properties.NAME || feature.properties.NAMELSAD || "Metro Area";
    feature.properties.name =
      feature.properties.NAME || feature.properties.NAMELSAD;
  });
}

function enrichCityFeatures(geojson: any, mapData: MapData): void {
  geojson.features.forEach((feature: any) => {
    const placeId = feature.properties.GEOID || feature.properties.PLACEFP;
    const placeName =
      feature.properties.NAME || feature.properties.NAMELSAD || "Unknown City";
    const stateFips = feature.properties.STATEFP;
    const stateAbbr = FIPS_TO_STATE[stateFips] || "";
    const entry = mapData[placeName] ?? mapData[placeId];
    feature.properties.value = getValueFromEntry(entry);
    feature.properties.dataDate = getDateFromEntry(entry);
    feature.properties.id = placeId;
    feature.properties.displayName = stateAbbr
      ? `${placeName}, ${stateAbbr}`
      : placeName;
    feature.properties.name = placeName;
  });
}

function enrichZipFeatures(
  geojson: any,
  mapData: MapData,
  zipNameLookup?: Record<string, string>,
): void {
  geojson.features.forEach((feature: any) => {
    const zipCode = feature.properties.ZCTA5CE20 || feature.properties.GEOID20;
    const key = zipCode ? normalizeZipKey(zipCode) : "";
    const entry = key ? mapData[key] : undefined;
    feature.properties.value = getValueFromEntry(entry);
    feature.properties.dataDate = getDateFromEntry(entry);
    feature.properties.id = zipCode;
    // Use city/state display name from geographies table when available
    const displayName = zipNameLookup?.[key] ?? zipCode;
    feature.properties.displayName = displayName;
    feature.properties.name = displayName;
  });
}

function enrichTractFeatures(geojson: any, mapData: MapData): void {
  geojson.features.forEach((feature: any) => {
    const tractId = feature.properties.GEOID || feature.properties.TRACTCE;
    const tractName =
      feature.properties.NAMELSAD ||
      feature.properties.NAME ||
      `Tract ${tractId}`;
    const stateFips = feature.properties.STATEFP;
    const countyFips = feature.properties.COUNTYFP;
    const stateAbbr = FIPS_TO_STATE[stateFips] || "";
    const entry = mapData[tractId];
    feature.properties.value = getValueFromEntry(entry);
    feature.properties.dataDate = getDateFromEntry(entry);
    feature.properties.id = tractId;
    feature.properties.displayName = `${tractName}${stateAbbr ? `, ${stateAbbr}` : ""}`;
    feature.properties.countyFips = stateFips + countyFips;
  });
}

/** Case-insensitive lookup in mapData for state names that differ in capitalization. */
function findCaseInsensitive(mapData: MapData, name: string): any {
  if (!name) return undefined;
  const lower = name.toLowerCase();
  for (const key of Object.keys(mapData)) {
    if (key.toLowerCase() === lower) return mapData[key];
  }
  return undefined;
}
