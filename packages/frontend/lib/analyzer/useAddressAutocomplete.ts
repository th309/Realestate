import { useEffect, useRef, useState } from "react";
import type { AddressSuggestion } from "./types";

interface MapboxFeature {
  id: string;
  place_name: string;
  text: string;
  /** House number for address-type results (Mapbox returns it separately from `text`). */
  address?: string;
  center: [number, number];
  context?: Array<{ id: string; text: string; short_code?: string }>;
}

function parse(feature: MapboxFeature): AddressSuggestion {
  const ctx = feature.context ?? [];
  const postcode = ctx.find((c) => c.id.startsWith("postcode"))?.text ?? null;
  const place = ctx.find((c) => c.id.startsWith("place"))?.text ?? "";
  const region = ctx.find((c) => c.id.startsWith("region"));
  const state = region?.short_code?.replace("US-", "") ?? "";
  // Mapbox puts the house number in `feature.address`, not `feature.text`
  // (which is the street name only). Prepend it so the dropdown shows
  // "123 S Market St" rather than just "S Market St".
  const street = feature.address
    ? `${feature.address} ${feature.text}`
    : feature.text;
  return {
    id: feature.id,
    full: feature.place_name,
    street,
    city: place,
    state,
    postalCode: postcode,
    lon: feature.center[0],
    lat: feature.center[1],
  };
}

export function useAddressAutocomplete() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const cache = useRef<Map<string, AddressSuggestion[]>>(new Map());

  useEffect(() => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    if (cache.current.has(query)) {
      setSuggestions(cache.current.get(query)!);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!token) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query,
        )}.json?access_token=${token}&autocomplete=true&types=address&country=us&limit=5`;
        const res = await fetch(url);
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const data = await res.json();
        const parsed = (data.features ?? []).map(parse);
        cache.current.set(query, parsed);
        setSuggestions(parsed);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  return { query, setQuery, suggestions, loading };
}
