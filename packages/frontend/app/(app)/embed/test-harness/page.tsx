"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import type { WidgetStatus } from "./harness-types";
import { WIDGETS, CATEGORY_LABELS, CATEGORY_ORDER } from "./harness-types";
import { WidgetCard } from "./WidgetCard";
import { StatusSummary } from "./StatusSummary";

// ---------------------------------------------------------------------------
// Inner component (reads searchParams)
// ---------------------------------------------------------------------------

function TestHarnessInner() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") ?? "";

  const [token, setToken] = useState(initialToken);
  const [statuses, setStatuses] = useState<Record<string, WidgetStatus>>({});

  const handleStatusChange = useCallback((id: string, status: WidgetStatus) => {
    setStatuses((prev) => ({ ...prev, [id]: status }));
  }, []);

  // Group widgets by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    widgets: WIDGETS.filter((w) => w.category === cat),
  })).filter((g) => g.widgets.length > 0);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "20px 24px",
        }}
      >
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#111827",
            margin: 0,
          }}
        >
          PropertyIQ Embed Test Harness
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
          Developer tool — all widgets are live iframes hitting real embed
          endpoints
        </p>

        {/* Token input */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <label
            htmlFor="embed-token"
            style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}
          >
            Token:
          </label>
          <input
            id="embed-token"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="emb_xxx..."
            style={{
              flex: 1,
              maxWidth: 480,
              padding: "8px 12px",
              fontSize: 13,
              fontFamily: "monospace",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              outline: "none",
              background: "#f9fafb",
            }}
          />
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            Paste an embed token to test authenticated widgets
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        {/* Status summary */}
        <StatusSummary statuses={statuses} />

        {/* Widget sections */}
        {grouped.map((group) => (
          <section key={group.category} style={{ marginTop: 32 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#111827",
                marginBottom: 16,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {group.label}
            </h2>

            {/* Grid: scores/metrics 3-up, map full width, charts 2-up */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  group.category === "map"
                    ? "1fr"
                    : group.category === "chart"
                      ? "1fr 1fr"
                      : "1fr 1fr 1fr",
                gap: 16,
              }}
            >
              {group.widgets.map((widget) => (
                <WidgetCard
                  key={widget.id}
                  config={widget}
                  token={token}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          </section>
        ))}

        {/* Report placeholder */}
        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#111827",
              marginBottom: 16,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Report Embed
          </h2>
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              border: "1px dashed #d1d5db",
              padding: "32px 24px",
              textAlign: "center",
              color: "#6b7280",
              fontSize: 14,
            }}
          >
            Report embed requires a report ID — generate a report first, then
            use{" "}
            <code
              style={{
                background: "#f3f4f6",
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 12,
              }}
            >
              /embed/report/&#123;reportId&#125;?token=emb_xxx
            </code>
          </div>
        </section>

        {/* Footer spacer */}
        <div style={{ height: 48 }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export with Suspense boundary for useSearchParams
// ---------------------------------------------------------------------------

export default function EmbedTestHarnessPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#f3f4f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: "#6b7280",
          }}
        >
          Loading test harness...
        </div>
      }
    >
      <TestHarnessInner />
    </Suspense>
  );
}
