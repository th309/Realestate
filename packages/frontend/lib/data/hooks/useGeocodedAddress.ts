/**
 * USE GEOCODED ADDRESS HOOK
 *
 * Building-level coordinates for a postal address.
 *
 * Caching note: this caches a coordinate, not imagery. Google's terms permit
 * caching geocoding results; they prohibit caching Street View pixels.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchGeocodedAddress,
  type GeocodeResult,
} from "../fetchers/geocoding";

const TWO_HOURS = 1000 * 60 * 60 * 2;

export function useGeocodedAddress(address: string | null | undefined) {
  const trimmed = address?.trim() ?? "";

  return useQuery<GeocodeResult | null>({
    queryKey: ["geocode", trimmed],
    queryFn: () => fetchGeocodedAddress(trimmed),
    enabled: trimmed.length > 0,
    staleTime: TWO_HOURS,
    gcTime: TWO_HOURS,
    retry: false,
  });
}
