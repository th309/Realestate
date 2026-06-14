"use client";

import { useSearchParams } from "next/navigation";

interface EmbedIframeProps {
  /** Path relative to the app root, e.g. "/embed/score/metro/31080" */
  embedPath: string;
  /** Additional query params to append to the iframe src (excluding token) */
  embedParams?: Record<string, string>;
  /** CSS height for the iframe. Defaults to "300px". */
  height?: string;
  /** CSS width for the iframe. Defaults to "100%". */
  width?: string;
  /** Accessible title for the iframe element */
  title: string;
}

/**
 * Renders a real PropertyIQ embed iframe inside the demo brokerage site.
 *
 * Reads the ?token= query param from the parent page URL and passes it
 * to the iframe src so the embedded widget authenticates correctly.
 * If no token is present, shows a placeholder message instead.
 */
export function EmbedIframe({
  embedPath,
  embedParams = {},
  height = "300px",
  width = "100%",
  title,
}: EmbedIframeProps) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  if (!token) {
    return (
      <div
        style={{
          height,
          width,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f1f5f9",
          borderRadius: 8,
          border: "2px dashed #cbd5e1",
          padding: 24,
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 14,
            color: "#64748b",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Add{" "}
          <code
            style={{
              backgroundColor: "#e2e8f0",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            ?token=your_embed_token
          </code>{" "}
          to the URL to see live widgets.
        </p>
      </div>
    );
  }

  // Build the full iframe src with token + any extra params
  const params = new URLSearchParams({ token, ...embedParams });
  const src = `${embedPath}?${params.toString()}`;

  return (
    <iframe
      src={src}
      title={title}
      width={width}
      height={height}
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        backgroundColor: "#ffffff",
      }}
      loading="lazy"
      allow="clipboard-write"
    />
  );
}
