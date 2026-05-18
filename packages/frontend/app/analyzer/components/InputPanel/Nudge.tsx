"use client";

export type NudgeLevel = "ok" | "warn";

interface NudgeProps {
  level: NudgeLevel;
  text: string;
}

export function Nudge({ level, text }: NudgeProps) {
  // Use M3 on-container text tokens so contrast is high in BOTH themes:
  //   ok:   deep green (#1b5e20)  on light green (#e8f5e9)
  //   warn: deep red    (#410e0b) on peach        (#f9dedc)
  // Previously warn used `--md-warning` (orange #ff8f00) on `--md-error-
  // container` (peach #f9dedc) — orange-on-peach, low contrast and visually
  // unappealing.
  const tone =
    level === "ok"
      ? "text-[var(--md-on-tertiary-container)] bg-[var(--md-tertiary-container)]"
      : "text-[var(--md-on-error-container)] bg-[var(--md-error-container)]";
  return (
    <div
      data-nudge
      data-level={level}
      className={`mt-1 text-[11px] italic px-2 py-1 rounded ${tone}`}
    >
      {text}
    </div>
  );
}
