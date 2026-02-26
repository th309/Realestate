"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { EntitlementsProvider, PaywallProvider } from "@/lib/entitlements";

/**
 * Extract HTTP status code from an error.
 *
 * Our fetchers throw standard `Error` objects with messages like
 * "API error: 401" or "Failed to fetch report: Not Found".
 * This helper extracts the numeric status code when present.
 */
function getErrorStatusCode(error: unknown): number | null {
  // Check for a `status` or `statusCode` property (custom error classes)
  if (
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as Record<string, unknown>).status === "number"
  ) {
    return (error as Record<string, unknown>).status as number;
  }

  // Parse status code from error message (e.g. "API error: 404")
  if (error instanceof Error) {
    const match = error.message.match(/\b([45]\d{2})\b/);
    if (match) return parseInt(match[1], 10);
  }

  return null;
}

/**
 * Determine whether a failed query should be retried.
 *
 * Retryable: network errors (no status code) and 5xx server errors.
 * Not retryable: 4xx client errors (bad request, unauthorized, not found, etc.).
 */
function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const MAX_RETRIES = 3;

  if (failureCount >= MAX_RETRIES) return false;

  const statusCode = getErrorStatusCode(error);

  // No status code means a network error (DNS failure, timeout, etc.) — retry
  if (statusCode === null) return true;

  // 4xx client errors are not transient — don't retry
  if (statusCode >= 400 && statusCode < 500) return false;

  // 5xx server errors are potentially transient — retry
  if (statusCode >= 500) return true;

  // Any other status code — retry to be safe
  return true;
}

/**
 * Exponential backoff delay: 1s, 2s, 4s, capped at 30s.
 */
function retryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 30000);
}

// Create a client instance that persists across re-renders
// Using a function to create it lazily avoids issues with SSR
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
        retryDelay,
      },
      mutations: {
        // Mutations (POST/PUT/DELETE) should not auto-retry —
        // they may not be idempotent and retrying could cause
        // duplicate side effects (double charges, duplicate records, etc.)
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EntitlementsProvider>
          <PaywallProvider>{children}</PaywallProvider>
        </EntitlementsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
