"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WidgetConfig, WidgetStatus } from "./harness-types";
import { LOAD_TIMEOUT_MS } from "./harness-types";

/**
 * Renders a single embed widget as an iframe with load/error status tracking.
 * Shows [OK] on successful load, [FAIL] on error or 15s timeout, [...] while loading.
 */
export function WidgetCard({
  config,
  token,
  onStatusChange,
}: {
  config: WidgetConfig;
  token: string;
  onStatusChange: (id: string, status: WidgetStatus) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<WidgetStatus>("loading");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLoad = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus("loaded");
    onStatusChange(config.id, "loaded");
  }, [config.id, onStatusChange]);

  const handleError = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus("error");
    onStatusChange(config.id, "error");
  }, [config.id, onStatusChange]);

  useEffect(() => {
    setStatus("loading");
    onStatusChange(config.id, "loading");

    timeoutRef.current = setTimeout(() => {
      setStatus((prev) => {
        if (prev === "loading") {
          onStatusChange(config.id, "error");
          return "error";
        }
        return prev;
      });
    }, LOAD_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [config.id, token, onStatusChange]);

  const statusIcon =
    status === "loaded" ? "[OK]" : status === "error" ? "[FAIL]" : "[...]";

  const statusColor =
    status === "loaded"
      ? "#16a34a"
      : status === "error"
        ? "#dc2626"
        : "#a3a3a3";

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid #f3f4f6",
          background: "#fafafa",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>
          {config.label}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "monospace",
            color: statusColor,
          }}
        >
          {statusIcon}
        </span>
      </div>

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={config.src(token)}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          width: "100%",
          height: config.height,
          border: "none",
          display: "block",
        }}
        title={config.label}
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}
