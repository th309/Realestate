interface Props {
  letter: "A" | "B" | "C" | "D" | "F";
  /** Optional qualifier (e.g. "Strong cash flow", "Marginal", "Walk away"). */
  qualifier?: string;
  /** px / pt — defaults to 88 (large cover-page ring). */
  size?: number;
}

/**
 * Editorial grade ring used on the cover page of the PDF. Single-letter
 * grade rendered in Source Serif 4 at large size, with a thin accent-color
 * ring and an optional qualifier label below. Pure presentational —
 * grade comes from the saved snapshot.
 */
export function GradeRingLarge({ letter, qualifier, size = 88 }: Props) {
  const ringWidth = Math.max(3, Math.round(size * 0.04));
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          border: `${ringWidth}px solid var(--pdf-accent, #3949AB)`,
        }}
      >
        <span
          style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontWeight: 600,
            fontSize: size * 0.55,
            lineHeight: 1,
            color: "var(--pdf-ink, #1A237E)",
          }}
        >
          {letter}
        </span>
      </div>
      {qualifier && <span className="type-label">{qualifier}</span>}
    </div>
  );
}
