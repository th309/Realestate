import { CheckCircle2 } from "lucide-react";
import { PromptBubble } from "./PromptBubble";

const RESPONSE_CHIPS = [
  "$512K median",
  "41 days on market",
  "Score 71 · FIRMING",
];

/**
 * Hero's signature moment: a real prompt an agent would type, answered by
 * a row of live data chips — dramatizing what "connect PropertyIQ to
 * Claude" actually gets you, before any install instructions appear.
 */
export function McpHero() {
  return (
    <section className="max-w-3xl mx-auto px-6 pt-16 pb-14 text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1 text-xs font-mono font-medium uppercase tracking-wide text-on-primary-container">
        MCP Integration · 44 tools
      </span>

      <h1 className="mt-5 text-4xl md:text-5xl font-bold text-on-surface tracking-tight text-balance">
        Add PropertyIQ to Claude
      </h1>

      <p className="mt-4 text-lg text-on-surface-variant text-balance">
        Win listings, prep buyer consultations, and answer any market question —
        live PropertyIQ data, right inside your AI assistant.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <a
          href="#install"
          className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-on-primary shadow-sm hover:bg-primary/90 transition-colors duration-200"
        >
          Connect now
        </a>
        <a
          href="/docs/mcp/reference"
          className="text-sm font-medium text-primary hover:underline"
        >
          Browse all 44 tools →
        </a>
      </div>

      <div className="mt-12 text-left space-y-2">
        <PromptBubble prompt="Build a listing presentation for 78704 — home values, days on market, price trends." />
        <div className="flex items-start gap-3 rounded-2xl bg-primary-container/40 border border-primary/20 px-5 py-4">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-1" />
          <div className="flex flex-wrap gap-2">
            {RESPONSE_CHIPS.map((chip) => (
              <span
                key={chip}
                className="rounded-full bg-surface px-3 py-1 text-xs font-mono font-medium text-on-surface"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
