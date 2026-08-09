import { JumpBar } from "@/app/components/app-shell";
import { getJumpItems, JUMP_BAR_STICKY } from "../../lib/jump-items";

/**
 * The results column's in-page nav, pinned below the app chrome so every
 * section stays one click away at any scroll depth.
 *
 * Two details the bar cannot supply itself:
 *
 * - The wrapper paints `bg-piq-canvas`. The bar has its own `bg-surface`, but
 *   its rounded corners and the padding around it are transparent, so without
 *   this the results column shows through as it scrolls underneath.
 * - `layout="scroll"` holds the bar to a single row. Left to wrap it takes two
 *   rows on a phone, and a sticky bar that tall costs more viewport than the
 *   scrolling it saves.
 */
export function StickyJumpBar({ hasGrading }: { hasGrading: boolean }) {
  return (
    <div className={`${JUMP_BAR_STICKY} bg-piq-canvas py-2`}>
      <JumpBar
        items={getJumpItems(hasGrading)}
        activeId={hasGrading ? "verdict" : "cashflow"}
        layout="scroll"
      />
    </div>
  );
}
