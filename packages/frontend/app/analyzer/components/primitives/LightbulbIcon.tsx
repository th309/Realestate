/**
 * Lightbulb icon used to mark AI-generated insight panels across the
 * analyzer. Stroke uses `currentColor` so the caller's text color drives
 * the bulb fill — keeps it consistent with the AIAnnotation it sits next to.
 *
 * Accepts an optional `size` (default 14) so the same icon can render at a
 * larger scale in the recommendation analysis panel without forking the SVG.
 */
interface LightbulbIconProps {
  size?: number;
}

export function LightbulbIcon({ size = 14 }: LightbulbIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 1 5 11.95V16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2.05A7 7 0 0 1 12 2z" />
    </svg>
  );
}
