"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { trackEvent } from "@/lib/analytics/tracker";
import {
  PERSONA_ORDER,
  PERSONA_SNAPSHOTS,
  MCP_EXCHANGE,
  type PersonaKey,
  type PersonaSnapshot,
} from "./snapshots";

const TAB_LABELS: Record<PersonaKey, string> = {
  investor: "Investor",
  agent: "Agent",
  buyer: "First-time buyer",
  developer: "Power user",
};

const VERDICT_TONE: Record<string, string> = {
  neg: "bg-red-50 text-red-700",
  warn: "bg-amber-50 text-amber-700",
  pos: "bg-green-50 text-green-700",
};

function valueColor(tone?: string): string {
  if (tone === "neg") return "text-red-700";
  if (tone === "pos") return "text-green-700";
  return "text-on-surface";
}

function StatPanel({ snap }: { snap: PersonaSnapshot }) {
  return (
    <div className="rounded-xl bg-surface p-6 shadow-sm md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-serif text-2xl font-semibold text-on-surface">
            {snap.feature}
          </p>
          <p className="font-mono text-sm text-on-surface-variant">
            {snap.market}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${VERDICT_TONE[snap.verdict.tone]}`}
        >
          {snap.verdict.text}
        </span>
      </div>

      <dl className="mt-6 divide-y divide-outline/40">
        {snap.stats.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between py-2.5"
          >
            <dt className="text-sm text-on-surface-variant">{row.label}</dt>
            <dd
              className={`font-mono text-base font-medium ${valueColor(row.tone)}`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-5 text-xs text-on-surface-variant">{snap.caption}</p>
    </div>
  );
}

function McpPanel() {
  return (
    <div className="overflow-hidden rounded-xl bg-inverse-surface text-inverse-on-surface shadow-sm">
      <div className="border-b border-white/10 px-6 py-4">
        <p className="font-serif text-2xl font-semibold">
          PropertyIQ where you already work.
        </p>
        <p className="mt-1 text-sm text-inverse-on-surface/80">
          Ask Claude about any market — it answers from our live data. No
          dashboard required. {MCP_EXCHANGE.feature}.
        </p>
      </div>
      <div className="space-y-4 px-6 py-5 font-mono text-sm">
        <div>
          <p className="text-inverse-on-surface/60">{"// you ask Claude"}</p>
          <p className="mt-1">{MCP_EXCHANGE.question}</p>
        </div>
        <div>
          <p className="text-inverse-on-surface/60">
            {"// Claude calls PropertyIQ"}
          </p>
          <p className="mt-1 text-green-300">{MCP_EXCHANGE.toolCall}</p>
        </div>
        <div>
          <p className="text-inverse-on-surface/60">{"// live response"}</p>
          <pre className="mt-1 overflow-x-auto whitespace-pre text-inverse-on-surface/95">
            {MCP_EXCHANGE.response}
          </pre>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 py-3">
        <p className="text-xs text-inverse-on-surface/70">
          {MCP_EXCHANGE.caption} · No major real-estate-data platform ships a
          Claude/MCP integration like this.
        </p>
      </div>
    </div>
  );
}

export function PersonaShowcase() {
  const [active, setActive] = useState(0); // Investor default
  const [visible, setVisible] = useState(true);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function prefersReduced(): boolean {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function select(i: number) {
    if (i === active) return;
    trackEvent("persona.tab", { persona: PERSONA_ORDER[i] });
    if (prefersReduced()) {
      setActive(i);
      return;
    }
    // 200ms cross-fade: fade out, swap, fade in.
    setVisible(false);
    setTimeout(() => {
      setActive(i);
      setVisible(true);
    }, 150);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const last = PERSONA_ORDER.length - 1;
    let next = active;
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      next = active === last ? 0 : active + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = active === 0 ? last : active - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  }

  const activeKey = PERSONA_ORDER[active];

  return (
    <div className="mt-8">
      <div
        role="tablist"
        aria-label="What you can do with PropertyIQ"
        className="flex flex-wrap gap-2"
      >
        {PERSONA_ORDER.map((key, i) => {
          const selected = i === active;
          return (
            <button
              key={key}
              role="tab"
              id={`persona-tab-${key}`}
              aria-controls={`persona-panel-${key}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              onClick={() => select(i)}
              onKeyDown={onKeyDown}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                selected
                  ? "bg-primary text-on-primary shadow-sm"
                  : "bg-primary-container text-primary hover:bg-primary-light"
              }`}
            >
              {TAB_LABELS[key]}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`persona-panel-${activeKey}`}
        aria-labelledby={`persona-tab-${activeKey}`}
        tabIndex={0}
        className={`mt-6 transition-opacity duration-150 motion-reduce:transition-none motion-reduce:opacity-100 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {activeKey === "developer" ? (
          <McpPanel />
        ) : (
          <StatPanel snap={PERSONA_SNAPSHOTS[activeKey]} />
        )}
      </div>
    </div>
  );
}
