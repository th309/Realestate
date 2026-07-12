/**
 * usePropertyLookup — RentCast property lookup mutation.
 *
 * Mutation (not query) because it's user-triggered: a button click fetches
 * AVM + rent estimate + property record + comps for the entered address.
 *
 * Retries transient failures (network drop, 5xx) up to 2 times with React
 * Query's default backoff. Client errors (4xx: bad address, auth) fail
 * immediately — retrying them would just repeat the same rejection, and a
 * 429 never reaches retry because the fetcher returns the quota sentinel.
 */

import { useMutation } from "@tanstack/react-query";
import {
  fetchPropertyLookup,
  PropertyLookupHttpError,
  type PropertyLookupResult,
} from "../fetchers/property-lookup";

const MAX_PROPERTY_LOOKUP_RETRIES = 2;

/** Exported for tests. True = React Query should retry this failure. */
export function shouldRetryPropertyLookup(
  failureCount: number,
  error: Error,
): boolean {
  if (failureCount >= MAX_PROPERTY_LOOKUP_RETRIES) return false;
  // Non-HTTP errors (fetch TypeError, auth-session hiccup) are transient.
  if (!(error instanceof PropertyLookupHttpError)) return true;
  return error.status >= 500;
}

export function usePropertyLookup() {
  return useMutation<
    PropertyLookupResult | { quotaExceeded: true },
    Error,
    { address: string }
  >({
    mutationFn: fetchPropertyLookup,
    retry: shouldRetryPropertyLookup,
  });
}
