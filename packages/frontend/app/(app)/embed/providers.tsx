"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { EntitlementsProvider } from "@/lib/entitlements";

/**
 * Lightweight providers for embeddable widgets.
 *
 * Only includes QueryClient, Auth, and Entitlements (required by useScoreData).
 * Excludes TourProvider, PaywallProvider, and other app-specific providers
 * that are unnecessary in an embed context.
 */

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function EmbedProviders({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EntitlementsProvider>{children}</EntitlementsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
