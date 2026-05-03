"use client";

/**
 * USE ANONYMOUS LISTING PRESENTATION HOOK
 *
 * React Query mutation hook for generating an anonymous listing presentation
 * report during the activation tour (no auth required).
 *
 * The mutation handles rate limiting via TourRateLimitError thrown by the
 * fetcher — consumers should branch on `error instanceof TourRateLimitError`.
 */

import { useMutation } from "@tanstack/react-query";
import {
  generateAnonymousListingPresentation,
  type AnonReportResponse,
  type Persona,
  type MarketRef,
} from "../fetchers/anonymous-listing-presentation";

export interface UseAnonymousListingPresentationVariables {
  sessionId: string;
  persona: Persona;
  market: MarketRef;
}

export function useAnonymousListingPresentation() {
  return useMutation<
    AnonReportResponse,
    Error,
    UseAnonymousListingPresentationVariables
  >({
    mutationFn: generateAnonymousListingPresentation,
  });
}
