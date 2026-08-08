/**
 * USE PROPERTY IMAGERY HOOK
 *
 * Resolves Street View availability for the subject property.
 *
 * Caching note: this caches the metadata resolution (availability + pano id +
 * signed URL), never image bytes. Google's policy exempts panorama IDs from the
 * caching prohibition; it does not exempt imagery.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchStreetView,
  type StreetViewResolution,
} from "../fetchers/street-view";

const TWO_HOURS = 1000 * 60 * 60 * 2;

export function usePropertyImagery(
  lat: number | null,
  lon: number | null,
  address?: string,
) {
  return useQuery<StreetViewResolution>({
    queryKey: ["street-view", lat, lon, address ?? null],
    queryFn: () => fetchStreetView(lat as number, lon as number, address),
    enabled: lat != null && lon != null,
    staleTime: TWO_HOURS,
    gcTime: TWO_HOURS,
    retry: false,
  });
}
