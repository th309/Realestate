import type { ReactNode } from "react";
import { TrendingUp } from "lucide-react";
import { PiqCard, PiqCardHeader } from "../../primitives/card";

interface UpgradePathShellProps {
  /** Distinguishes the three strategy panels in the DOM for tests and styling. */
  dataAttribute: string;
  title: string;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  /** True once data resolved with nothing left to improve. */
  isAllClear: boolean;
  children: ReactNode;
}

/**
 * The card around the improvement levers, shared by buy-and-hold, flip and
 * BRRRR.
 *
 * All three panels were the same forty lines of shell — header, intro, three
 * loading skeletons, an error box, an all-clear box — copied per strategy, so
 * any change to the chrome had to be made three times and had drifted twice.
 * Only the title and the rows differ, so only those are props.
 */
export function UpgradePathShell({
  dataAttribute,
  title,
  isLoading,
  isError,
  errorMessage,
  isAllClear,
  children,
}: UpgradePathShellProps) {
  return (
    <PiqCard>
      <div {...{ [dataAttribute]: true }}>
        <PiqCardHeader
          icon={<TrendingUp size={13} strokeWidth={2} aria-hidden />}
          tone="amber"
          title={title}
          label="Single lever"
        />
        <p className="border-b border-piq-soft px-4 py-3 text-[12.5px] text-piq-body">
          Each metric below feeds into your overall grade. Pick a lever to lift
          that specific metric to its next tier.
        </p>

        {isLoading && (
          <div data-upgrade-loading className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[120px] animate-pulse rounded-xl bg-piq-canvas"
                aria-hidden
              />
            ))}
          </div>
        )}

        {isError && (
          <div
            data-upgrade-error
            role="alert"
            className="m-4 rounded-xl border border-piq-red bg-piq-red-soft px-4 py-3 text-[13px] text-piq-ink"
          >
            <strong>Couldn&apos;t compute upgrade path:</strong>{" "}
            {errorMessage ?? "unknown error"}
          </div>
        )}

        {isAllClear && (
          <div
            data-upgrade-all-clear
            className="m-4 rounded-xl border border-dashed border-piq-line bg-piq-canvas p-4 text-[12.5px] text-piq-body"
          >
            All metrics are grading A. No upgrades needed.
          </div>
        )}

        {children}
      </div>
    </PiqCard>
  );
}
