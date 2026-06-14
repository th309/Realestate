"use client";

import React, { useState, useMemo } from "react";
import { Copy, Check, Loader2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EmbedPreviewProps {
  /** Path only, e.g. "/embed/score/metro/31080?scoreType=homeready" */
  embedUrl: string;
  width: number;
  height: number;
  token: string;
}

/* ------------------------------------------------------------------ */
/*  Copy button with "Copied!" feedback                                */
/* ------------------------------------------------------------------ */

function CopyCodeButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable in some contexts */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          Copy Code
        </>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildFullUrl(embedUrl: string, token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const separator = embedUrl.includes("?") ? "&" : "?";
  return `${origin}${embedUrl}${separator}token=${token}`;
}

function buildProductionSnippet(
  embedUrl: string,
  token: string,
  width: number,
  height: number,
): string {
  const separator = embedUrl.includes("?") ? "&" : "?";
  const src = `https://www.propertyiq.app${embedUrl}${separator}token=${token}`;
  return [
    `<iframe`,
    `  src="${src}"`,
    `  width="${width}"`,
    `  height="${height}"`,
    `  frameborder="0"`,
    `  style="border-radius: 8px;"`,
    `></iframe>`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function EmbedPreview({
  embedUrl,
  width,
  height,
  token,
}: EmbedPreviewProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const fullUrl = useMemo(
    () => buildFullUrl(embedUrl, token),
    [embedUrl, token],
  );

  const embedSnippet = useMemo(
    () => buildProductionSnippet(embedUrl, token, width, height),
    [embedUrl, token, width, height],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ---- Live preview ---- */}
      <section>
        <h3 className="text-sm font-medium text-on-surface mb-3">
          Live Preview
        </h3>
        <div className="flex justify-center p-6 rounded-xl bg-surface-container-high/50 border border-outline-variant/30">
          <div className="relative" style={{ width, height, maxWidth: "100%" }}>
            {/* Loading overlay */}
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-surface-container border border-outline-variant">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Loading preview...</span>
                </div>
              </div>
            )}

            <iframe
              src={fullUrl}
              width={width}
              height={height}
              frameBorder="0"
              onLoad={() => setIframeLoaded(true)}
              title="Embed widget preview"
              style={{
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                maxWidth: "100%",
              }}
            />
          </div>
        </div>
      </section>

      {/* ---- Embed code ---- */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-on-surface">Embed Code</h3>
          <CopyCodeButton text={embedSnippet} />
        </div>
        <div className="bg-surface-container rounded-xl p-4 overflow-x-auto border border-outline-variant/30">
          <pre className="text-xs font-mono text-on-surface-variant whitespace-pre">
            <code>{embedSnippet}</code>
          </pre>
        </div>
      </section>
    </div>
  );
}
