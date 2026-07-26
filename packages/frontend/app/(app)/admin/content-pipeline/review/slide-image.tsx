"use client";

import { useState } from "react";

/**
 * One slide image with its own load/error state. When an `<img>` src swap fails,
 * Chrome keeps the PREVIOUS frame painted — so in a pager a failed slide
 * silently shows the last slide's pixels (wrong content, no error). This renders
 * an explicit failed state with a cache-busting Retry instead, and is remounted
 * per slide (keyed by src upstream) so a stale frame can never leak through.
 */
export function SlideImage({ src, label }: { src: string; label: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);

  // Cache-bust on retry so a cached failure (or a transient 401/500) is re-fetched.
  const resolvedSrc =
    attempt === 0
      ? src
      : `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}`;

  if (status === "error") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-sm text-on-surface-variant">
          {label} failed to load.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("loading");
            setAttempt((a) => a + 1);
          }}
          className="rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold text-on-surface transition-colors duration-200 hover:bg-surface-container-high"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={resolvedSrc}
      src={resolvedSrc}
      alt=""
      className="h-full w-full object-contain"
      onLoad={() => setStatus("loaded")}
      onError={() => setStatus("error")}
    />
  );
}
