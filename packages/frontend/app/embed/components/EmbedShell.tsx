"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchEmbedBranding, type EmbedBranding } from "@/lib/data";
import { EmbedBrandingBar } from "./EmbedBrandingBar";
import { EmbedLoadingSkeleton } from "./EmbedLoadingSkeleton";
import { EmbedErrorState } from "./EmbedErrorState";

// ---------------------------------------------------------------------------
// Branding context — lets child components access branding data
// ---------------------------------------------------------------------------

export const EmbedBrandingContext = createContext<EmbedBranding | null>(null);

export function useEmbedBranding(): EmbedBranding | null {
  return useContext(EmbedBrandingContext);
}

// ---------------------------------------------------------------------------
// Shell component
// ---------------------------------------------------------------------------

interface EmbedShellProps {
  children: React.ReactNode;
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; branding: EmbedBranding };

/**
 * EmbedShell — Main wrapper for all embed widgets.
 *
 * Reads `?token=` from the URL. When a token is present, fetches organization
 * branding and renders the branded header bar + powered-by footer around the
 * children. Without a token, renders children directly (backwards compat for
 * public embeds).
 *
 * Provides branding to children via EmbedBrandingContext.
 */
export function EmbedShell({ children }: EmbedShellProps) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<LoadState>(
    token ? { status: "loading" } : { status: "idle" },
  );

  useEffect(() => {
    if (!token) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;

    async function loadBranding() {
      setState({ status: "loading" });
      try {
        const branding = await fetchEmbedBranding(token!);
        if (!cancelled) {
          setState({ status: "success", branding });
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load branding";
          setState({ status: "error", message });
        }
      }
    }

    loadBranding();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // --- No token: render children directly (backwards compat) ---
  if (!token) {
    return (
      <EmbedBrandingContext.Provider value={null}>
        <div className="flex flex-col min-h-full">
          <div className="flex-1">{children}</div>
          <PoweredByFooter />
        </div>
      </EmbedBrandingContext.Provider>
    );
  }

  // --- Loading ---
  if (state.status === "loading") {
    return <EmbedLoadingSkeleton />;
  }

  // --- Error ---
  if (state.status === "error") {
    return (
      <EmbedErrorState
        message={state.message}
        onRetry={() => {
          setState({ status: "loading" });
          fetchEmbedBranding(token)
            .then((branding) => setState({ status: "success", branding }))
            .catch((err) =>
              setState({
                status: "error",
                message:
                  err instanceof Error
                    ? err.message
                    : "Failed to load branding",
              }),
            );
        }}
      />
    );
  }

  // --- Success ---
  const branding = state.status === "success" ? state.branding : null;

  return (
    <EmbedBrandingContext.Provider value={branding}>
      <div className="flex flex-col min-h-full">
        <EmbedBrandingBar branding={branding} />
        <div className="flex-1">{children}</div>
        <PoweredByFooter />
      </div>
    </EmbedBrandingContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function PoweredByFooter() {
  return (
    <div className="py-2 px-3 flex justify-center shrink-0">
      <a
        href="https://propertyiq.app"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] font-medium tracking-wide text-on-surface-variant
                   hover:text-primary transition-colors duration-200"
      >
        Powered by PropertyIQ
      </a>
    </div>
  );
}
