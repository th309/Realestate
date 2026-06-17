"use client";

/**
 * USE AUTHENTICATED LISTING PRESENTATION HOOK
 *
 * React Query mutation hook for generating a listing-presentation report for a
 * SIGNED-IN user (the tour aha-finale's authed path). Mirrors
 * `useAnonymousListingPresentation` but targets the JWT-guarded endpoint, which
 * is NOT rate-limited and resolves the market name server-side — so there is no
 * `TourRateLimitError` branch here.
 */

import { useMutation } from "@tanstack/react-query";
import {
  generateAuthenticatedListingPresentation,
  type AnonReportResponse,
  type AuthedMarketRef,
  type Persona,
} from "../fetchers/anonymous-listing-presentation";

export interface UseAuthenticatedListingPresentationVariables {
  sessionId: string;
  persona: Persona;
  market: AuthedMarketRef;
}

export function useAuthenticatedListingPresentation() {
  return useMutation<
    AnonReportResponse,
    Error,
    UseAuthenticatedListingPresentationVariables
  >({
    mutationFn: generateAuthenticatedListingPresentation,
  });
}
