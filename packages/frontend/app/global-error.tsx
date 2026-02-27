"use client";

import { trackEvent } from "@/lib/analytics/tracker";

// Minimal global error boundary to avoid prerendering issues
// See: https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-errors-in-root-layouts
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Track error shown once on render
  if (typeof window !== "undefined") {
    trackEvent("frustration.error_shown", {
      error_message: error?.message || "Unknown error",
      error_digest: error?.digest,
      page_path: window.location.pathname,
    });
  }
  return (
    <html lang="en">
      <head>
        <title>Error</title>
      </head>
      <body
        style={{
          margin: 0,
          padding: "2rem",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <h1>Something went wrong</h1>
        <p>An unexpected error occurred.</p>
        <button
          onClick={reset}
          style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
