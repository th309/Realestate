"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Section, SectionHeading } from "@/app/components/marketing";
import {
  PLATFORM_CATEGORIES,
  PLATFORM_FEATURES,
  type PlatformCategory,
} from "./platform-features-data";

/**
 * Homepage "Platform" band — the full toolkit behind the score.
 *
 * The three category chips are a real WAI-ARIA tablist rather than decoration:
 * a control that looks interactive has to work, so each chip filters the grid
 * to its own cards (3 / 2 / 1) and selection follows arrow-key focus. The grid
 * keeps three columns at every breakpoint above `md` so cards stay the same
 * width when a narrower category is selected.
 */
export function PlatformFeatures() {
  const baseId = useId();
  const panelId = `${baseId}-platform-panel`;
  const tabId = (index: number) => `${baseId}-platform-tab-${index}`;

  const [activeCategory, setActiveCategory] = useState<PlatformCategory>(
    PLATFORM_CATEGORIES[0],
  );
  const activeIndex = PLATFORM_CATEGORIES.indexOf(activeCategory);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const visibleFeatures = PLATFORM_FEATURES.filter(
    (feature) => feature.category === activeCategory,
  );

  /** Roving tabindex with automatic activation, per the APG tabs pattern. */
  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const lastIndex = PLATFORM_CATEGORIES.length - 1;
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = index === lastIndex ? 0 : index + 1;
    } else if (event.key === "ArrowLeft") {
      nextIndex = index === 0 ? lastIndex : index - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = lastIndex;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    setActiveCategory(PLATFORM_CATEGORIES[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <Section id="platform-features" surface="none">
      <SectionHeading
        eyebrow="Platform"
        title="Everything you need to judge a market like an allocator"
        subhead="Built for investors and agents alike — the full toolkit behind the score."
      />

      <div
        role="tablist"
        aria-label="Platform capabilities"
        className="mb-11 flex flex-wrap justify-center gap-2.5"
      >
        {PLATFORM_CATEGORIES.map((category, index) => {
          const isActive = category === activeCategory;
          return (
            <button
              key={category}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={tabId(index)}
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveCategory(category)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`rounded-full border px-[22px] py-[11px] text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive
                  ? "border-primary bg-primary-container text-on-primary-container"
                  : "border-outline-variant bg-surface text-on-surface hover:border-primary/40"
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(activeIndex)}
        tabIndex={0}
        className="grid gap-5 focus-visible:outline-none md:grid-cols-3"
      >
        {visibleFeatures.map((feature) => {
          const Icon = feature.icon;
          return (
            <article
              key={feature.title}
              className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface p-7 shadow-sm"
            >
              <span
                className={`grid size-[46px] shrink-0 place-items-center rounded-[13px] ${feature.tileTone}`}
              >
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-semibold tracking-tight text-on-surface">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-on-surface-variant">
                {feature.description}
              </p>
              <p className="mt-auto pt-3 font-mono text-[13px] font-semibold tabular-nums text-primary">
                {feature.stat}
              </p>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
