"use client";

/**
 * Storybook-style demo for DealGrade — every grade tier in Pro + Free states,
 * plus streaming and loading states.
 *
 * View at /analyzer/dev/deal-grade
 */
import { DealGrade, type DealGradeLetter } from "./DealGrade";
import { piq } from "./piqTokens";

const SAMPLE_VERDICTS: Record<string, string> = {
  A: "Strong cap rate at 8.4%, DSCR comfortably above 1.30, and the metro is in the top quartile for net migration. Push offer 5% under list — seller has carrying cost pressure.",
  B: "Cashflow positive at $312/mo with a 1.22 DSCR, but cap rate is right at the metro median. Solid hold; not a deal you'd walk away from but not a steal either.",
  C: "Cap rate of 5.4% is below the metro median by 12% and DSCR is 1.08 — thin margin. Worth analyzing as a flip; the appreciation forecast is the only reason this pencils.",
  D: "DSCR drops to 0.92 at current rate. You'd cover ~$180/mo out of pocket. The 70% rule says max offer is $315K vs. $389K ask — walk unless you can renegotiate.",
  F: "Negative cashflow of −$847/mo with DSCR 0.71. Metro PIQ score of 28 puts it in the bottom decile. Pass.",
};

const STREAMING_SAMPLE =
  "Strong cap rate at 8.4%, DSCR comfortably above 1.30, and the metro is in the top quartile for net migration. Push";

function DemoSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2
          className="text-xs font-semibold uppercase"
          style={{ color: piq.textMuted, letterSpacing: "0.14em" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: "13px", color: piq.textMuted, margin: 0 }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function DealGradeDemo() {
  return (
    <main
      className="min-h-screen px-8 py-12"
      style={{ background: piq.canvas, color: piq.textPrimary }}
    >
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="space-y-2">
          <h1
            className="text-3xl font-semibold"
            style={{ color: piq.textPrimary, letterSpacing: "-0.02em" }}
          >
            DealGrade — visual reference
          </h1>
          <p style={{ fontSize: "14px", color: piq.textMuted, margin: 0 }}>
            Letter grade + qualifier + streaming AI verdict. Anchors the top of
            the analyzer page.
          </p>
        </header>

        <DemoSection
          title="Pro tier — five main grade tiers"
          subtitle="Each tier maps to a distinct accent color: green / teal / amber / orange / red."
        >
          <DealGrade
            grade="A"
            qualifier="Strong cash flow"
            isPro
            strategy="buy-hold"
            aiVerdict={SAMPLE_VERDICTS.A}
          />
          <DealGrade
            grade="B"
            qualifier="Solid hold"
            isPro
            strategy="buy-hold"
            aiVerdict={SAMPLE_VERDICTS.B}
          />
          <DealGrade
            grade="C"
            qualifier="Marginal"
            isPro
            strategy="flip"
            aiVerdict={SAMPLE_VERDICTS.C}
          />
          <DealGrade
            grade="D"
            qualifier="Tight margins"
            isPro
            strategy="brrrr"
            aiVerdict={SAMPLE_VERDICTS.D}
          />
          <DealGrade
            grade="F"
            qualifier="Walk away"
            isPro
            strategy="multifamily"
            aiVerdict={SAMPLE_VERDICTS.F}
          />
        </DemoSection>

        <DemoSection
          title="Modifier rendering (+ and −)"
          subtitle="The modifier is 60% of the main letter size, baseline-aligned."
        >
          <DealGrade
            grade="A+"
            qualifier="Exceptional"
            isPro
            strategy="buy-hold"
            aiVerdict={SAMPLE_VERDICTS.A}
          />
          <DealGrade
            grade="A-"
            qualifier="Strong with caveat"
            isPro
            strategy="buy-hold"
            aiVerdict={SAMPLE_VERDICTS.A}
          />
          <DealGrade
            grade="C+"
            qualifier="Edge of acceptable"
            isPro
            strategy="flip"
            aiVerdict={SAMPLE_VERDICTS.C}
          />
        </DemoSection>

        <DemoSection
          title="Streaming state"
          subtitle="Pulsing cursor ▊ at the end of the verdict; max-height clamp disabled while streaming so text grows naturally."
        >
          <DealGrade
            grade="A"
            qualifier="Strong cash flow"
            isPro
            isStreaming
            strategy="buy-hold"
            aiVerdict={STREAMING_SAMPLE}
          />
        </DemoSection>

        <DemoSection
          title="Loading state (Pro tier, verdict not yet returned)"
          subtitle="Three muted pulsing lines — appears before the first streaming token arrives."
        >
          <DealGrade
            grade="B"
            qualifier="Solid hold"
            isPro
            strategy="buy-hold"
            aiVerdict={null}
          />
        </DemoSection>

        <DemoSection
          title="Free tier — locked state"
          subtitle="Heading + description + Pro indigo CTA. The grade itself stays visible (not paywalled)."
        >
          <DealGrade
            grade="C"
            qualifier="Marginal"
            isPro={false}
            strategy="buy-hold"
            onUpgrade={() => {
               
              alert("onUpgrade fired — wire to entitlements modal in Hero.");
            }}
          />
        </DemoSection>

        <DemoSection
          title="All 13 grade variants — color-tier reference"
          subtitle="Compact view; verdicts trimmed to fit. Useful for visually verifying the green / teal / amber / orange / red mapping."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(
              [
                "A+",
                "A",
                "A-",
                "B+",
                "B",
                "B-",
                "C+",
                "C",
                "C-",
                "D+",
                "D",
                "D-",
                "F",
              ] as DealGradeLetter[]
            ).map((g) => (
              <DealGrade
                key={g}
                grade={g}
                qualifier={
                  g.startsWith("A")
                    ? "Strong"
                    : g.startsWith("B")
                      ? "Solid"
                      : g.startsWith("C")
                        ? "Marginal"
                        : g.startsWith("D")
                          ? "Tight"
                          : "Avoid"
                }
                isPro
                strategy="buy-hold"
                aiVerdict={SAMPLE_VERDICTS[g.charAt(0)] ?? SAMPLE_VERDICTS.C}
              />
            ))}
          </div>
        </DemoSection>
      </div>
    </main>
  );
}
