import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "edge";

/**
 * Dynamic OG image generation endpoint for market pages.
 *
 * Query params:
 *   - title  (required): Market display name, e.g. "Austin, TX"
 *   - score  (optional): Numeric score 0-100 to render with color
 *   - insight (optional): One-liner insight sentence
 *
 * Returns a 1200x630 PNG image suitable for Open Graph / Twitter cards.
 */

// ---------------------------------------------------------------------------
// Score helpers (mirrored from ScoreDisplay — kept inline so the edge
// function has zero imports outside next/og)
// ---------------------------------------------------------------------------

function getScoreColor(value: number): string {
  const pct = Math.min(Math.max(value / 100, 0), 1);
  const hue = pct * 120; // 0 = red, 120 = green
  return `hsl(${hue}, 85%, 55%)`;
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "EXCELLENT";
  if (score >= 80) return "GREAT";
  if (score >= 70) return "GOOD";
  if (score >= 60) return "FAIR";
  if (score >= 50) return "AVERAGE";
  if (score >= 40) return "BELOW AVG";
  if (score >= 20) return "POOR";
  return "VERY POOR";
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const title = searchParams.get("title") ?? "Housing Market";
  const scoreRaw = searchParams.get("score");
  const insight = searchParams.get("insight");

  const homeValue = searchParams.get("homeValue");
  const appreciation = searchParams.get("appreciation");
  const dom = searchParams.get("dom");
  const supply = searchParams.get("supply");

  const metrics = [
    homeValue && { value: homeValue, label: "Home Value" },
    appreciation && { value: appreciation, label: "YoY Change" },
    dom && { value: dom, label: "Days on Mkt" },
    supply && { value: supply, label: "Supply" },
  ].filter(Boolean) as Array<{ value: string; label: string }>;

  const score = scoreRaw ? Math.min(Math.max(Number(scoreRaw), 0), 100) : null;
  const scoreColor = score !== null ? getScoreColor(score) : null;
  const scoreLabel = score !== null ? getScoreLabel(score) : null;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px 80px",
        background: "linear-gradient(145deg, #0f172a 0%, #1e293b 100%)",
        fontFamily: "sans-serif",
        color: "#f1f5f9",
      }}
    >
      {/* Top bar: logo + tagline */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "40px",
        }}
      >
        {/* Accent dot as simple brand mark */}
        <div
          style={{
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            background: "#3949AB",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "24px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#94a3b8",
          }}
        >
          PropertyIQ
        </span>
      </div>

      {/* Market title */}
      <div
        style={{
          fontSize: "64px",
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
          marginBottom: "12px",
          color: "#f8fafc",
        }}
      >
        {title}
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: "28px",
          fontWeight: 400,
          color: "#94a3b8",
          marginBottom: score !== null ? "36px" : "0px",
        }}
      >
        Housing Market Analysis 2026
      </div>

      {/* Score block (only if score provided) */}
      {score !== null && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
          }}
        >
          {/* Score circle */}
          <div
            style={{
              width: "96px",
              height: "96px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `4px solid ${scoreColor}`,
              background: "rgba(255,255,255,0.05)",
            }}
          >
            <span
              style={{
                fontSize: "40px",
                fontWeight: 800,
                color: scoreColor ?? "#f8fafc",
              }}
            >
              {Math.round(score)}
            </span>
          </div>

          {/* Score label + insight */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <span
              style={{
                fontSize: "22px",
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "0.08em",
                color: scoreColor ?? "#f8fafc",
              }}
            >
              {scoreLabel}
            </span>
            {insight && (
              <span
                style={{
                  fontSize: "20px",
                  fontWeight: 400,
                  color: "#cbd5e1",
                  maxWidth: "800px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {insight}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Metrics row */}
      {metrics.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "40px",
            marginTop: score !== null ? "36px" : "24px",
          }}
        >
          {metrics.map((m) => (
            <div
              key={m.label}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <span
                style={{
                  fontSize: "28px",
                  fontWeight: 700,
                  color: "#f8fafc",
                }}
              >
                {m.value}
              </span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 400,
                  color: "#94a3b8",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.05em",
                }}
              >
                {m.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom accent line */}
      <div
        style={{
          position: "absolute",
          bottom: "0",
          left: "0",
          right: "0",
          height: "4px",
          background:
            "linear-gradient(90deg, #1A237E 0%, #3949AB 50%, #5C6BC0 100%)",
        }}
      />
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
