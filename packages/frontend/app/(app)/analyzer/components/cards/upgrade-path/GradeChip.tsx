import type { Letter } from "@propertyiq/analyzer-core";

/**
 * The spec's `.gp.sm` — the 19px round grade mark used in the "F → D" pairing
 * at the head of each lever row. Fixed size so the pairing keeps its width
 * whatever letters land in it.
 */
export function GradeChip({
  letter,
  color,
}: {
  letter: Letter;
  color: { fg: string; bg: string };
}) {
  return (
    <span
      aria-label={`Grade ${letter}`}
      className="inline-grid size-[19px] place-items-center rounded-full font-mono text-[10px] font-bold tabular-nums"
      style={{ color: color.fg, background: color.bg }}
    >
      {letter}
    </span>
  );
}
