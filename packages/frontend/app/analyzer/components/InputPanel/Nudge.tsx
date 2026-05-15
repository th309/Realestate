"use client";

export type NudgeLevel = "ok" | "warn";

interface NudgeProps {
  level: NudgeLevel;
  text: string;
}

export function Nudge({ level, text }: NudgeProps) {
  const tone =
    level === "ok"
      ? "text-[var(--md-tertiary)] bg-[var(--md-tertiary-container)]"
      : "text-[var(--md-warning)] bg-[var(--md-error-container)]";
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
