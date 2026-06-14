import { useEffect, useRef, useState } from "react";
import {
  geocodeAddress,
  type AddressSuggestion,
} from "../fetchers/address-geocode";

/**
 * Debounced street-address autocomplete. Aborts the in-flight request when the
 * query changes so suggestions never arrive out of order.
 */
export function useAddressGeocode(query: string, debounceMs = 250) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.trim().length < 4) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      geocodeAddress(query, controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) setSuggestions(next);
        })
        .finally(() => setLoading(false));
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [query, debounceMs]);

  return { suggestions, loading };
}
