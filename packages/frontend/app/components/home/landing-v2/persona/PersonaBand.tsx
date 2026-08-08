"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowRight, ArrowDown, Check } from "lucide-react";
import { trackEvent } from "@/lib/analytics/tracker";
import { PrimaryCta } from "../PrimaryCta";
import { PERSONA_PANELS } from "./persona-panels";

/**
 * The persona band from the approved mockup: a green toggle above a
 * green-bordered card, the pitch on the left and the proof points on the
 * right.
 *
 * Green throughout because this is a persuasion surface, and the mockup gives
 * green the persona, the steps and the closing ask while indigo keeps product
 * chrome (CLAUDE.md section 8.2's two-accent split).
 *
 * A real tablist, not two styled spans — the toggle changes what is on screen,
 * so it needs the roles and the arrow-key handling that go with that.
 */
export function PersonaBand() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(index: number) {
    if (index === active) return;
    trackEvent("persona.tab", { persona: PERSONA_PANELS[index].key });
    setActive(index);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const last = PERSONA_PANELS.length - 1;
    let next = active;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = active === last ? 0 : active + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = active === 0 ? last : active - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  }

  const panel = PERSONA_PANELS[active];
  const { Icon } = panel;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Who PropertyIQ is for"
        className="mb-9 flex flex-wrap justify-center gap-3"
      >
        {PERSONA_PANELS.map((option, index) => {
          const selected = index === active;
          const TabIcon = option.Icon;
          return (
            <button
              key={option.key}
              role="tab"
              id={`persona-tab-${option.key}`}
              aria-controls={`persona-panel-${option.key}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              onClick={() => select(index)}
              onKeyDown={onKeyDown}
              className={`inline-flex items-center gap-2.5 rounded-full border px-6 py-3 text-[15.5px] font-bold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tertiary ${
                selected
                  ? "border-transparent bg-tertiary text-on-tertiary"
                  : "border-outline-variant bg-surface text-on-surface"
              }`}
            >
              <TabIcon
                aria-hidden="true"
                className={`size-[19px] ${selected ? "text-on-tertiary" : "text-tertiary-text"}`}
              />
              {option.tab}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`persona-panel-${panel.key}`}
        aria-labelledby={`persona-tab-${panel.key}`}
        tabIndex={0}
        className="mx-auto rounded-[20px] border-2 border-tertiary bg-surface p-10"
      >
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <div className="mb-5 flex items-start gap-3.5">
              <span className="grid size-12 flex-none place-items-center rounded-[14px] bg-tertiary-container text-tertiary-text">
                <Icon aria-hidden="true" className="size-[23px]" />
              </span>
              <div>
                <h3 className="text-[22px] font-bold tracking-tight text-on-surface">
                  {panel.title}
                </h3>
                <p className="text-sm text-on-surface-variant">
                  {panel.tagline}
                </p>
              </div>
            </div>

            <p className="text-[15.5px] leading-relaxed text-on-surface-variant">
              {panel.body}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-outline-variant pt-7">
              <PrimaryCta
                source="persona"
                label="Start free"
                subtext={null}
                accent="tertiary"
                icon={<ArrowRight className="size-[17px]" />}
              />
              <Link
                href="/scores/methodology"
                className="inline-flex h-14 items-center gap-2.5 rounded-full border border-tertiary px-6 text-[15px] font-bold text-tertiary-text transition-colors duration-200 hover:bg-tertiary-container"
              >
                See the methodology
                <ArrowDown aria-hidden="true" className="size-[17px]" />
              </Link>
            </div>
          </div>

          <ul className="flex list-none flex-col gap-4 p-0">
            {panel.checks.map((check) => (
              <li
                key={check}
                className="flex items-start gap-3 text-[15.5px] text-on-surface"
              >
                <span className="mt-0.5 grid size-[22px] flex-none place-items-center rounded-full bg-tertiary text-on-tertiary">
                  <Check
                    aria-hidden="true"
                    className="size-3"
                    strokeWidth={3}
                  />
                </span>
                {check}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
