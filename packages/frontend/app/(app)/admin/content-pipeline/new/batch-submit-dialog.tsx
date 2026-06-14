"use client";
import { useState } from "react";
import { M3Dialog } from "../components/m3-dialog";

const PER_RENDER_COST_USD = 0.1;
const REQUIRES_ACK_AT = 250;

export function BatchSubmitDialog({
  open,
  count,
  onCancel,
  onConfirm,
  submitting,
}: {
  open: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  const requiresAck = count >= REQUIRES_ACK_AT;
  const [acked, setAcked] = useState(false);
  const cost = (count * PER_RENDER_COST_USD).toFixed(2);

  return (
    <M3Dialog
      open={open}
      onClose={submitting ? () => {} : onCancel}
      ariaLabel="Confirm batch submission"
    >
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-medium">Review batch</h2>
        <p className="text-sm">
          You&apos;re about to create <strong>{count} runs</strong> at an
          estimated cost of <span className="font-mono">≈ ${cost}</span>. Each
          run will render a video and (depending on approval mode) publish to
          the platforms you selected.
        </p>
        {requiresAck && (
          <label className="flex items-start gap-2 text-sm bg-warning-container/40 rounded-lg p-3">
            <input
              type="checkbox"
              checked={acked}
              onChange={(e) => setAcked(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              I understand this will create <strong>{count} runs</strong> and
              cost <span className="font-mono">≈ ${cost}</span>.
            </span>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-on-surface hover:bg-on-surface/8 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting || (requiresAck && !acked)}
            className="px-5 py-2.5 rounded-full text-sm font-medium bg-primary text-on-primary disabled:opacity-50"
          >
            {submitting ? "Submitting…" : `Submit ${count} runs`}
          </button>
        </div>
      </div>
    </M3Dialog>
  );
}
