import { useState } from "react";
import { Gift } from "lucide-react";
import { TrialStatusBadge } from "./TrialStatusBadge";

export interface ActiveTrial {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  tier: string;
  startedAt: string;
  expiresAt: string;
  daysRemaining: number;
  convertedAt: string | null;
  cancelledAt: string | null;
  paywallHits: number;
  reasonCode: string | null;
  reasonLabel: string | null;
  detail: string | null;
}

export function TrialsTable({
  trials,
  onExtend,
  onCancel,
}: {
  trials: ActiveTrial[];
  onExtend: (userId: string) => void;
  onCancel: (userId: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (trials.length === 0) {
    return (
      <div className="text-center py-8">
        <Gift className="w-12 h-12 text-on-surface-variant mx-auto mb-3" />
        <p className="text-on-surface-variant">No trials yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left border-b border-outline-variant">
            <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              User
            </th>
            <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              Status
            </th>
            <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
              Why they left
            </th>
            <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider text-right">
              Usage
            </th>
            <th className="pb-3 text-xs font-medium text-on-surface-variant uppercase tracking-wider text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {trials.map((trial) => (
            <tr
              key={trial.id}
              className="border-b border-outline-variant last:border-0"
            >
              <td className="py-3">
                <div>
                  <div className="text-sm font-medium text-on-surface">
                    {trial.userName}
                  </div>
                  <div className="text-xs text-on-surface-variant">
                    {trial.userEmail}
                  </div>
                </div>
              </td>
              <td className="py-3">
                <TrialStatusBadge
                  daysRemaining={trial.daysRemaining}
                  convertedAt={trial.convertedAt}
                  cancelledAt={trial.cancelledAt}
                />
              </td>
              <td className="py-3 max-w-xs">
                {trial.reasonLabel ? (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(expandedId === trial.id ? null : trial.id)
                    }
                    className="text-left"
                  >
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      {trial.reasonLabel}
                    </span>
                    {trial.detail && expandedId === trial.id && (
                      <div className="text-xs text-on-surface-variant mt-1 italic">
                        &ldquo;{trial.detail}&rdquo;
                      </div>
                    )}
                  </button>
                ) : (
                  <span className="text-xs text-on-surface-variant">—</span>
                )}
              </td>
              <td className="py-3 text-right text-sm text-on-surface-variant">
                {trial.paywallHits} features used
              </td>
              <td className="py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onExtend(trial.userId)}
                    className="text-xs text-primary hover:underline"
                  >
                    Extend
                  </button>
                  <button
                    onClick={() => onCancel(trial.userId)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
