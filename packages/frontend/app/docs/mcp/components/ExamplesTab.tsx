"use client";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Example {
  title: string;
  prompt: string;
  tools: string[];
  result: string;
}

// ─── Data ──────────────────────────────────────────────────────────────────

const EXAMPLES: Example[] = [
  {
    title: "Quick Market Check",
    prompt: "What's the real estate market like in Nashville right now?",
    tools: ["search_markets", "get_market_snapshot", "get_propertyiq_score"],
    result:
      "A comprehensive overview \u2014 median home values, rents, days on market, inventory, PropertyIQ score with grade and trend.",
  },
  {
    title: "Investor Deal Analysis",
    prompt:
      "I'm looking at a $350K property in ZIP 37209 with expected rent of $2,100/mo. Is it a good deal? Also, where is Nashville in the market cycle?",
    tools: ["deal_analyzer", "market_cycle_position", "cashflow_estimate"],
    result:
      "GRM, cap rate, cash-on-cash return analysis, market cycle position (Recovery/Expansion/Hyper-Supply/Recession), and a monthly cashflow breakdown.",
  },
  {
    title: "Agent Buyer Prep",
    prompt:
      "I have a buyer meeting tomorrow for the Denver metro area. They have a $500K budget. Prepare my consultation brief.",
    tools: ["search_markets", "buyer_consultation_brief"],
    result:
      "A ready-to-use prep sheet with affordability analysis, competition level, days on market, inventory trends, and talking points.",
  },
  {
    title: "Content Creation",
    prompt:
      "Write me a LinkedIn post about the Austin housing market with the latest data.",
    tools: ["search_markets", "generate_linkedin_post"],
    result:
      "A data-backed LinkedIn post draft with current statistics, formatted for the platform with engagement hooks.",
  },
  {
    title: "Portfolio Health Check",
    prompt:
      "Check the health of my rental portfolio across these markets: ZIP 30301, 37209, and 78701.",
    tools: ["portfolio_market_health", "rent_pricing_analysis (\u00d73)"],
    result:
      "A dashboard view of all three markets with health flags, rent trends, and any deterioration warnings.",
  },
  {
    title: "Compare Markets for Relocation",
    prompt:
      "My client is moving from Chicago to either Austin or Raleigh. Compare both options.",
    tools: ["search_markets (\u00d73)", "relocation_package"],
    result:
      "A side-by-side narrative comparing cost of living, job market, home values, growth trajectory, and quality of life indicators.",
  },
];

const PRO_TIPS = [
  <>
    <strong>Be specific with geography</strong> &mdash;{" "}
    <code className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded text-on-surface">
      ZIP 90210
    </code>{" "}
    works better than &quot;Beverly Hills area&quot;
  </>,
  <>
    <strong>Chain requests</strong> &mdash; ask follow-up questions to dig
    deeper into any result
  </>,
  <>
    <strong>Ask for comparisons</strong> &mdash; the server excels at
    side-by-side market analysis
  </>,
  <>
    <strong>Request specific formats</strong> &mdash; &quot;as a table&quot;,
    &quot;as a bullet list&quot;, &quot;ready to paste into an email&quot;
  </>,
];

// ─── Sub-components ────────────────────────────────────────────────────────

function ToolBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex px-2 py-0.5 rounded bg-surface-container font-mono text-xs text-primary">
      {label}
    </span>
  );
}

function ToolChain({ tools }: { tools: string[] }) {
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant">
      <span className="font-medium">Tools used:</span>
      {tools.map((tool, i) => (
        <span key={tool} className="inline-flex items-center gap-1.5">
          <ToolBadge label={tool} />
          {i < tools.length - 1 && (
            <span className="text-on-surface-variant">&rarr;</span>
          )}
        </span>
      ))}
    </p>
  );
}

function ExampleCard({ example }: { example: Example }) {
  return (
    <div className="rounded-xl border border-outline-variant/50 p-5 space-y-3">
      <h3 className="text-base font-medium text-on-surface">{example.title}</h3>

      {/* Prompt callout */}
      <div>
        <span className="text-xs text-on-surface-variant">You say:</span>
        <div className="mt-1 bg-primary/5 rounded-lg p-3 text-sm font-medium text-on-surface">
          &ldquo;{example.prompt}&rdquo;
        </div>
      </div>

      <ToolChain tools={example.tools} />

      <p className="text-sm text-on-surface-variant">
        <span className="font-medium text-on-surface">What you get: </span>
        {example.result}
      </p>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function ExamplesTab() {
  return (
    <div className="space-y-8">
      {/* Intro */}
      <p className="text-sm text-on-surface-variant">
        These examples show what you can ask your AI assistant once the MCP
        server is connected. Each prompt triggers one or more PropertyIQ tools
        behind the scenes.
      </p>

      {/* Example cards */}
      <div className="space-y-5">
        {EXAMPLES.map((example) => (
          <ExampleCard key={example.title} example={example} />
        ))}
      </div>

      {/* Pro Tips */}
      <div className="rounded-xl border border-outline-variant p-5 space-y-3">
        <h3 className="text-base font-medium text-on-surface">Pro Tips</h3>
        <ul className="space-y-2">
          {PRO_TIPS.map((tip, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-on-surface-variant"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
