import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, FileText, MapPin, Target } from "lucide-react";
import { Section, SectionHeading } from "@/app/components/marketing";

/**
 * Homepage "How it works" band — the three-step path from picking a market to
 * acting on it, rendered as three cards separated by connector arrows.
 *
 * Fully static, so this stays a server component. The arrows are decorative
 * only: they carry no meaning the card order doesn't already convey, so they
 * are hidden from the accessibility tree and dropped entirely on narrow
 * viewports where the cards stack vertically.
 */

type Step = {
  title: string;
  body: string;
  Icon: LucideIcon;
  /** Tint pair for the icon tile plus the matching low-opacity card border. */
  tile: string;
  border: string;
};

const STEPS: Step[] = [
  {
    title: "Pick a market",
    body: "Search any metro, county, or ZIP — or start from the map and let the color tell you where to look.",
    Icon: MapPin,
    tile: "bg-accent-violet-container text-accent-violet",
    border: "border-accent-violet/20",
  },
  {
    title: "Read the score",
    body: "One number, four inputs, a confidence grade, and the state benchmark it's measured against.",
    Icon: Target,
    tile: "bg-tertiary-container text-tertiary",
    border: "border-tertiary/20",
  },
  {
    title: "Act before the crowd",
    body: "Export a branded report, set an alert, or query it straight from Claude over MCP.",
    Icon: FileText,
    tile: "bg-warning-container text-on-warning-container",
    border: "border-warning/20",
  },
];

export function StepsSection() {
  return (
    <Section surface="a">
      <SectionHeading
        eyebrow="How it works"
        title="Three steps to a defensible market call"
      />

      {/* The contract container already caps content at the mockup's ~1120px. */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_30px_1fr_30px_1fr]">
        {STEPS.map((step, index) => (
          <Fragment key={step.title}>
            {index > 0 ? (
              <div
                aria-hidden="true"
                className="hidden items-center justify-center text-on-surface-variant lg:flex"
              >
                <ArrowRight className="h-5 w-5" />
              </div>
            ) : null}

            <div
              className={`flex flex-col items-center gap-3 rounded-xl border ${step.border} bg-surface px-6 py-8 text-center shadow-sm`}
            >
              <span
                className={`grid h-14 w-14 place-items-center rounded-xl ${step.tile}`}
              >
                <step.Icon className="h-6 w-6" />
              </span>
              <h3 className="text-lg font-semibold tracking-tight text-on-surface">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                {step.body}
              </p>
            </div>
          </Fragment>
        ))}
      </div>
    </Section>
  );
}
