import { Users, TrendingUp, Building2, KeyRound } from "lucide-react";
import { PromptBubble } from "./PromptBubble";

const AGENT_PROMPTS = [
  "Build a listing presentation for 78704 — home values, days on market, price trends.",
  "Prep a buyer consultation brief for a family relocating to Nashville.",
  "Draft my monthly market update email for clients in Travis County.",
];

const PERSONA_CARDS = [
  {
    icon: TrendingUp,
    title: "Investors",
    prompt: "Run the numbers on a $350K duplex in ZIP 78745.",
    payoff: "Cap rate, cash-on-cash return, and a full cashflow breakdown.",
  },
  {
    icon: Building2,
    title: "Brokerages & teams",
    prompt: "Which farm areas around Charlotte are heating up?",
    payoff: "Emerging markets ranked before your competitors notice.",
  },
  {
    icon: KeyRound,
    title: "Property managers",
    prompt: "What should my 2BR in 30318 rent for?",
    payoff: "Current rent index, trend, and a suggested pricing range.",
  },
];

export function CapabilitiesSection() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-14">
      <span className="text-xs font-mono font-medium uppercase tracking-wide text-primary">
        Once connected
      </span>
      <h2 className="mt-2 text-2xl font-semibold text-on-surface">
        What you can ask for
      </h2>

      {/* Featured agent card */}
      <div className="mt-6 rounded-xl border border-outline-variant/50 bg-primary-container/20 p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold text-on-surface">
            For real estate agents
          </h3>
        </div>
        <div className="space-y-2">
          {AGENT_PROMPTS.map((prompt) => (
            <PromptBubble key={prompt} prompt={prompt} compact />
          ))}
        </div>
      </div>

      {/* Persona cards */}
      <div className="mt-4 grid sm:grid-cols-3 gap-4">
        {PERSONA_CARDS.map(({ icon: Icon, title, prompt, payoff }) => (
          <div
            key={title}
            className="rounded-xl border border-outline-variant/50 bg-gradient-to-br from-primary-container/30 to-surface p-5"
          >
            <Icon className="w-5 h-5 text-primary mb-3" />
            <h3 className="text-sm font-semibold text-on-surface mb-2">
              {title}
            </h3>
            <p className="font-serif text-sm text-on-surface leading-snug mb-2">
              &ldquo;{prompt}&rdquo;
            </p>
            <p className="text-xs text-on-surface-variant">{payoff}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-sm text-on-surface-variant">
        Every answer pulls from the same 44-tool data layer — scores, snapshots,
        forecasts, demographics, and comparisons.{" "}
        <a
          href="/docs/mcp/reference"
          className="text-primary hover:underline font-medium"
        >
          Browse all 44 tools →
        </a>
      </p>
    </section>
  );
}
