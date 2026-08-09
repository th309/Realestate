import {
  TriangleAlert,
  Calculator,
  BarChart3,
  TrendingUp,
  Map as MapIcon,
} from "lucide-react";
import type { JumpItem } from "@/app/components/app-shell";

/**
 * In-page navigation for the analyzer's results column.
 *
 * Items and order come from the approved mockup's `.jump` bar — Verdict, Cash
 * Flow, Grading, Improve, Market — each with its own accent tile, matching the
 * mockup's per-item tile colours (red / indigo / violet / amber / teal).
 *
 * Each `id` must match the `id` on the corresponding section wrapper:
 * `verdict`, `grading` and `improve` live inside `GradingResultPanel`,
 * `cashflow` in `AnalyzerClient`, and `market` in `AnalyzerSections`.
 * Extracted from `AnalyzerClient.tsx` to keep that component under the §1.3
 * 400-line cap.
 */
/**
 * The three anchors that live inside `GradingResultPanel`, which renders only
 * once the grading query returns a result. Fix & Flip with no ARV, or BRRRR
 * with no rehab budget, produce no grading — so these sections are absent and
 * their jump links would scroll nowhere.
 */
const GRADING_ANCHORS = new Set(["verdict", "grading", "improve"]);

/**
 * Where the jump bar pins, measured from the top of the viewport.
 *
 * The analyzer scrolls on the window, under two bars that are already sticky:
 * the AppBar, and GlobalBreadcrumbs directly beneath it. Their combined height
 * is `--app-chrome-h` (defined in app/globals.css, and the single source of
 * truth for that stack — it also absorbs the safe-area inset when the installed
 * PWA runs standalone), so pinning there puts the jump bar just below both.
 * `z-30` keeps it under the breadcrumbs (`z-40`) and the AppBar (`z-50`), so it
 * slides beneath them rather than over them.
 */
export const JUMP_BAR_STICKY = "sticky top-[var(--app-chrome-h)] z-30";

/**
 * Scroll margin every jump target must carry.
 *
 * An anchor scrolls its target flush to the viewport top, which parks it behind
 * the sticky chrome. This reserves the full stack: `--app-chrome-h` (the AppBar
 * + breadcrumbs height, defined in app/globals.css) for the chrome the jump bar
 * pins under, plus 76px for the jump bar itself — its 68px (52px bar + 16px of
 * canvas padding) and 8px of air — so an anchored section lands just below the
 * bar rather than under it.
 */
export const JUMP_TARGET_SCROLL_MARGIN =
  "scroll-mt-[calc(var(--app-chrome-h)_+_76px)]";

/**
 * Jump items for the current state. Never offer a link to a section that is
 * not on the page.
 */
export function getJumpItems(hasGrading: boolean): JumpItem[] {
  return hasGrading
    ? JUMP_ITEMS
    : JUMP_ITEMS.filter((item) => !GRADING_ANCHORS.has(item.id));
}

export const JUMP_ITEMS: JumpItem[] = [
  {
    id: "verdict",
    label: "Verdict",
    icon: <TriangleAlert className="size-3" />,
    accent: "bg-error",
  },
  {
    id: "cashflow",
    label: "Cash Flow",
    icon: <Calculator className="size-3" />,
    accent: "bg-primary",
  },
  {
    id: "grading",
    label: "Grading",
    icon: <BarChart3 className="size-3" />,
    accent: "bg-secondary",
  },
  {
    id: "improve",
    label: "Improve",
    icon: <TrendingUp className="size-3" />,
    accent: "bg-warning",
  },
  {
    id: "market",
    label: "Market",
    icon: <MapIcon className="size-3" />,
    accent: "bg-tertiary",
  },
];
