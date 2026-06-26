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

// Brand palette from CLAUDE.md §8.2
const BRAND = {
  primaryDark: "#1A237E",
  primary: "#3949AB",
  primaryMedium: "#5C6BC0",
  primaryLight: "#C5CAE9",
  primaryContainer: "#E8EAF6",
  accentGreen: "#00C853",
  errorRed: "#B3261E",
  warningAmber: "#FF8F00",
  surface: "#FAFBFF",
} as const;

function getScoreColor(value: number): string {
  if (value >= 70) return BRAND.accentGreen;
  if (value >= 50) return BRAND.primaryMedium;
  if (value >= 40) return BRAND.warningAmber;
  return BRAND.errorRed;
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "VERY STRONG";
  if (score >= 80) return "STRONG";
  if (score >= 70) return "RISING";
  if (score >= 60) return "FIRMING";
  if (score >= 50) return "STEADY";
  if (score >= 40) return "EASING";
  if (score >= 20) return "WEAK";
  return "VERY WEAK";
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
    supply && { value: supply, label: "Pending Ratio" },
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
        background: `linear-gradient(145deg, ${BRAND.primaryDark} 0%, #283593 60%, ${BRAND.primary} 100%)`,
        fontFamily: "Roboto, sans-serif",
        color: "#fff",
      }}
    >
      {/* Top bar: brand mark + name */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          marginBottom: "40px",
        }}
      >
        <div
          style={{
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: BRAND.primaryLight,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "22px",
            fontWeight: 500,
            letterSpacing: "0.02em",
            color: BRAND.primaryLight,
          }}
        >
          PropertyIQ
        </span>
        <span
          style={{
            fontSize: "14px",
            fontWeight: 400,
            color: BRAND.primaryMedium,
            marginLeft: "4px",
          }}
        >
          The IQ Behind Every Market
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
          color: "#fff",
        }}
      >
        {title}
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: "26px",
          fontWeight: 400,
          color: BRAND.primaryLight,
          marginBottom: score !== null ? "36px" : "0px",
        }}
      >
        Market Intelligence Report
      </div>

      {/* Score block (only if score provided) */}
      {score !== null && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            background: "rgba(255,255,255,0.08)",
            borderRadius: "20px",
            padding: "20px 28px",
          }}
        >
          {/* Score circle */}
          <div
            style={{
              width: "88px",
              height: "88px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `5px solid ${scoreColor}`,
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <span
              style={{
                fontSize: "38px",
                fontWeight: 800,
                fontFamily: "Roboto Mono, monospace",
                color: "#fff",
              }}
            >
              {Math.round(score)}
            </span>
          </div>

          {/* Score label */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <span
              style={{
                fontSize: "24px",
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "0.06em",
                color: scoreColor ?? "#fff",
              }}
            >
              {scoreLabel}
            </span>
            <span
              style={{
                fontSize: "15px",
                fontWeight: 400,
                color: BRAND.primaryLight,
                letterSpacing: "0.02em",
              }}
            >
              PropertyIQ Score
            </span>
            {insight && (
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: 400,
                  color: BRAND.primaryLight,
                  maxWidth: "700px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginTop: "2px",
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
            gap: "48px",
            marginTop: "32px",
            padding: "0 4px",
          }}
        >
          {metrics.map((m) => (
            <div
              key={m.label}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "30px",
                  fontWeight: 700,
                  fontFamily: "Roboto Mono, monospace",
                  color: "#fff",
                }}
              >
                {m.value}
              </span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: BRAND.primaryLight,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.08em",
                }}
              >
                {m.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom accent bar */}
      <div
        style={{
          position: "absolute",
          bottom: "0",
          left: "0",
          right: "0",
          height: "6px",
          background: `linear-gradient(90deg, ${BRAND.accentGreen} 0%, ${BRAND.primaryLight} 50%, ${BRAND.primaryMedium} 100%)`,
        }}
      />
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
