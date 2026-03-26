"use client";

import { Suspense } from "react";
import { DemoNav, DemoSection, DemoFooter, EmbedIframe } from "../components";

/**
 * Demo Brokerage Site — Market Report Page
 *
 * Demonstrates embedding a full PropertyIQ market report. Since reports
 * require a specific report ID, this page shows instructions alongside
 * a live embed that renders when a valid report ID is provided via the
 * ?report= query param.
 */
export default function DemoSiteReportPage() {
  return (
    <Suspense>
      <DemoSiteReportContent />
    </Suspense>
  );
}

function DemoSiteReportContent() {
  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <DemoNav />

      <main style={{ flex: 1 }}>
        <DemoSection
          title="Embedded Market Report"
          subtitle="Deliver branded, data-rich market reports directly on your site"
        >
          {/* Explanation box */}
          <div
            style={{
              backgroundColor: "#f0f4f8",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: 24,
              marginBottom: 32,
              maxWidth: 720,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <h3
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 18,
                fontWeight: 600,
                color: "#1e3a5f",
                margin: "0 0 12px",
              }}
            >
              How it works
            </h3>
            <ol
              style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: 15,
                color: "#334155",
                lineHeight: 1.8,
                margin: 0,
                paddingLeft: 20,
              }}
            >
              <li>
                Generate a market report in PropertyIQ for any metro, county, or
                ZIP code.
              </li>
              <li>
                Copy the report ID from the report URL (e.g.{" "}
                <code
                  style={{
                    backgroundColor: "#e2e8f0",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontSize: 13,
                  }}
                >
                  /reports/abc-123-def
                </code>
                ).
              </li>
              <li>
                Add{" "}
                <code
                  style={{
                    backgroundColor: "#e2e8f0",
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontSize: 13,
                  }}
                >
                  &report=your_report_id
                </code>{" "}
                to this page&apos;s URL to see the live embed below.
              </li>
            </ol>
          </div>

          {/* Live report embed — only shows if ?report= is present */}
          <ReportEmbed />
        </DemoSection>
      </main>

      <DemoFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner component: reads ?report= param to render the report iframe
// ---------------------------------------------------------------------------

function ReportEmbed() {
  // We need to read searchParams from window since we're already inside
  // Suspense — this is a simple read from the URL.
  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  const reportId = params.get("report");
  const token = params.get("token");

  if (!reportId) {
    return (
      <div
        style={{
          height: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
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
            &report=your_report_id
          </code>{" "}
          to the URL to see a live embedded report.
        </p>
      </div>
    );
  }

  // Build iframe src
  const iframeParams = new URLSearchParams();
  if (token) iframeParams.set("token", token);
  const src = `/embed/report/${reportId}?${iframeParams.toString()}`;

  return (
    <iframe
      src={src}
      title="PropertyIQ Market Report"
      width="100%"
      height="800px"
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
