"use client";

import { motion } from "framer-motion";
import { BarChart3, Sparkles } from "lucide-react";
import { ControlBar } from "@/app/components/app-shell";

interface ReportBuilderControlBarProps {
  marketCount: number;
  maxMarkets: number;
  canGenerate: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
}

/**
 * The builder's single control row, replacing a ~110px indigo gradient band
 * that held only a title and a tagline, stacked under a separate breadcrumb
 * row — roughly 180px of chrome before any content.
 *
 * The Generate CTA lives here rather than at the foot of the form. On the live
 * page it sat below a mostly empty left column, greyed out, so you scrolled
 * past ~400px of nothing to reach a button you could not press. Sticky and
 * always visible, it sits beside a capacity meter that says how many of the
 * five market slots are used — which is also what makes the disabled state
 * legible, since the meter shows zero when the button is dead.
 */
export function ReportBuilderControlBar({
  marketCount,
  maxMarkets,
  canGenerate,
  isGenerating,
  onGenerate,
}: ReportBuilderControlBarProps) {
  return (
    <div className="sticky top-0 z-30">
      <ControlBar>
        <span className="flex items-center gap-2.5 border-r border-outline-variant pr-3">
          <span
            aria-hidden
            className="grid size-6 place-items-center rounded-[7px] bg-primary-container text-on-primary-container"
          >
            <BarChart3 className="size-3.5" />
          </span>
          <span>
            <span className="block text-sm font-bold leading-tight text-on-surface">
              PropertyIQ Report
            </span>
            <span className="block text-[11.5px] text-on-surface-variant">
              Powered by PropertyIQ Score
            </span>
          </span>
        </span>

        <span
          className="flex items-center gap-2 text-[11.5px] text-on-surface-variant"
          aria-label={`${marketCount} of ${maxMarkets} markets selected`}
        >
          <span aria-hidden className="flex gap-[3px]">
            {Array.from({ length: maxMarkets }, (_, i) => (
              <span
                key={i}
                className={`size-[7px] rounded-full border ${
                  i < marketCount
                    ? "border-primary bg-primary"
                    : "border-outline-variant bg-surface-container"
                }`}
              />
            ))}
          </span>
          <span className="font-mono tabular-nums">
            {marketCount} of {maxMarkets}
          </span>
          <span>markets</span>
        </span>

        <span className="ml-auto flex items-center gap-2">
          {!canGenerate && !isGenerating && (
            <span className="text-[11.5px] text-on-surface-variant">
              Add a market to generate
            </span>
          )}
          <motion.button
            data-tour="reports-generate-btn"
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate || isGenerating}
            whileHover={canGenerate && !isGenerating ? { scale: 1.02 } : {}}
            whileTap={canGenerate && !isGenerating ? { scale: 0.98 } : {}}
            className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-on-primary shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <motion.span
                  aria-hidden
                  className="size-4 rounded-full border-2 border-current border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generate report
              </>
            )}
          </motion.button>
        </span>
      </ControlBar>
    </div>
  );
}
