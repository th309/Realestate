"use client";

import { useGeocodedAddress } from "@/lib/data";

export interface SubjectCoordinates {
  subjectLat: number | null;
  subjectLon: number | null;
  /** True when the position came from geocoding rather than the property record. */
  isGeocoded: boolean;
}

/**
 * The subject property's position, for the comps map and the imagery panel.
 *
 * RentCast's property record frequently carries no coordinates. The Analyzer
 * used to fall back to the centroid of the comparable sales, which is an
 * average of *other* buildings — for comps spread across neighbouring towns
 * that landed 7.8km away, in a different city and ZIP, silently placing the
 * subject pin and the Street View photo on an unrelated property.
 *
 * Geocoding the resolved address replaces that fallback. Only ROOFTOP and
 * RANGE_INTERPOLATED matches are accepted: GEOMETRIC_CENTER is a street
 * segment's midpoint and APPROXIMATE can be an entire city, either of which
 * would mislocate the subject just as badly. When nothing reliable is
 * available both values are null, and consumers render nothing rather than
 * something wrong.
 */
export function useSubjectCoordinates(
  propertyLat: number | null,
  propertyLon: number | null,
  displayAddress: string | null,
): SubjectCoordinates {
  const needsGeocode = propertyLat == null || propertyLon == null;
  const geocoded = useGeocodedAddress(needsGeocode ? displayAddress : null);
  const usable = geocoded.data?.isPropertyLevel ? geocoded.data : null;

  return {
    subjectLat: propertyLat ?? usable?.lat ?? null,
    subjectLon: propertyLon ?? usable?.lon ?? null,
    isGeocoded: needsGeocode && usable != null,
  };
}
