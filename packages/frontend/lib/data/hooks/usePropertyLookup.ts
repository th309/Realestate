/**
 * usePropertyLookup — RentCast property lookup mutation.
 *
 * Mutation (not query) because it's user-triggered: a button click fetches
 * AVM + rent estimate + property record + comps for the entered address.
 */

import { useMutation } from "@tanstack/react-query";
import {
  fetchPropertyLookup,
  type PropertyLookupResult,
} from "../fetchers/property-lookup";

export function usePropertyLookup() {
  return useMutation<
    PropertyLookupResult | { quotaExceeded: true },
    Error,
    { address: string }
  >({
    mutationFn: fetchPropertyLookup,
  });
}
