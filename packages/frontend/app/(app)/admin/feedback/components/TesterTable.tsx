/**
 * Tester Table Component
 *
 * Renders the active testers table with action buttons per row.
 */

'use client';

import {
  Copy,
  Check,
  RefreshCw,
  Mail,
  Trash2,
} from 'lucide-react';

interface Tester {
  id: string;
  name: string;
  email?: string;
  token?: string;
  is_active?: boolean;
  created_at?: string;
}

type ConfirmAction = {
  type: 'deactivate' | 'regenerate';
  testerId: string;
};

interface TesterTableProps {
  testers: Tester[];
  copiedId: string | null;
  actionLoading: string | null;
  confirmAction: ConfirmAction | null;
  onCopyLink: (token: string) => void;
  onDeactivate: (id: string) => void;
  onConfirmDeactivate: (id: string) => void;
  onRegenerate: (id: string) => void;
  onConfirmRegenerate: (id: string) => void;
  onResendEmail: (id: string) => void;
  onCancelConfirm: () => void;
  formatDate: (dateStr?: string) => string;
}

export function TesterTable({
  testers,
  copiedId,
  actionLoading,
  confirmAction,
  onCopyLink,
  onDeactivate,
  onConfirmDeactivate,
  onRegenerate,
  onConfirmRegenerate,
  onResendEmail,
  onCancelConfirm,
  formatDate,
}: TesterTableProps) {
  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
      <table className="w-full">
        <thead className="bg-surface-container-high">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Email
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Created
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {testers.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-8 text-center text-on-surface-variant"
              >
                No testers yet. Click &quot;Add Tester&quot; to create one.
              </td>
            </tr>
          ) : (
            testers.map((tester) => {
              const isConfirming = confirmAction?.testerId === tester.id;
              const isLoading = actionLoading === tester.id;

              return (
                <tr key={tester.id} className="hover:bg-surface-container-high">
                  <td className="px-4 py-3">
                    <span className="font-medium text-on-surface">
                      {tester.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {tester.email || '\u2014'}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {formatDate(tester.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {isConfirming ? (
                      <ConfirmBar
                        type={confirmAction!.type}
                        isLoading={isLoading}
                        onConfirm={() =>
                          confirmAction!.type === 'deactivate'
                            ? onConfirmDeactivate(tester.id)
                            : onConfirmRegenerate(tester.id)
                        }
                        onCancel={onCancelConfirm}
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        {tester.token && (
                          <ActionButton
                            onClick={() => onCopyLink(tester.token!)}
                            icon={
                              copiedId === tester.token ? (
                                <Check className="w-3.5 h-3.5 text-green-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )
                            }
                            label={copiedId === tester.token ? 'Copied!' : 'Copy Link'}
                            disabled={isLoading}
                          />
                        )}

                        {tester.email && (
                          <ActionButton
                            onClick={() => onResendEmail(tester.id)}
                            icon={<Mail className="w-3.5 h-3.5" />}
                            label="Email"
                            disabled={isLoading}
                          />
                        )}

                        <ActionButton
                          onClick={() => onRegenerate(tester.id)}
                          icon={<RefreshCw className="w-3.5 h-3.5" />}
                          label="New Link"
                          disabled={isLoading}
                        />

                        <ActionButton
                          onClick={() => onDeactivate(tester.id)}
                          icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                          label=""
                          disabled={isLoading}
                          className="hover:bg-red-50"
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function ActionButton({
  onClick,
  icon,
  label,
  disabled,
  className = '',
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-surface-container-high text-on-surface hover:bg-primary/10 disabled:opacity-50 transition-colors ${className}`}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}

function ConfirmBar({
  type,
  isLoading,
  onConfirm,
  onCancel,
}: {
  type: 'deactivate' | 'regenerate';
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const message =
    type === 'deactivate'
      ? 'Deactivate this tester?'
      : 'Regenerate link? Old link will stop working.';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-on-surface-variant">{message}</span>
      <button
        onClick={onConfirm}
        disabled={isLoading}
        className="px-2 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 font-medium"
      >
        {isLoading ? 'Working...' : 'Yes'}
      </button>
      <button
        onClick={onCancel}
        disabled={isLoading}
        className="px-2 py-1 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-container font-medium"
      >
        Cancel
      </button>
    </div>
  );
}
