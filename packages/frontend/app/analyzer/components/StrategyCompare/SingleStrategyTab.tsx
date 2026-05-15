"use client";
import { useState } from "react";

export type StrategyKey = "buyAndHold" | "flip" | "brrrr";

interface SingleStrategyTabProps {
  defaultKey?: StrategyKey;
  buyAndHold: React.ReactNode;
  flip: React.ReactNode;
  brrrr: React.ReactNode;
  onChange?: (k: StrategyKey) => void;
}

const TABS: Array<{ key: StrategyKey; label: string }> = [
  { key: "buyAndHold", label: "Buy & Hold" },
  { key: "flip", label: "Flip" },
  { key: "brrrr", label: "BRRRR" },
];

export function SingleStrategyTab({
  defaultKey = "buyAndHold",
  buyAndHold,
  flip,
  brrrr,
  onChange,
}: SingleStrategyTabProps) {
  const [active, setActive] = useState<StrategyKey>(defaultKey);
  const slot =
    active === "buyAndHold" ? buyAndHold : active === "flip" ? flip : brrrr;
  return (
    <div data-single-strategy-tab>
      <div
        role="tablist"
        className="flex gap-1 border-b border-outline-variant mb-4"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            data-tab={t.key}
            aria-selected={active === t.key}
            onClick={() => {
              setActive(t.key);
              onChange?.(t.key);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              active === t.key
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div data-strategy-body>{slot}</div>
    </div>
  );
}
