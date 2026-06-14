/**
 * Tester Manager Component
 *
 * Create and manage beta testers with shareable links and email invites.
 * Supports: create, soft-delete, reactivate, regenerate link, resend email.
 */

'use client';

import { useState } from 'react';
import { UserPlus, X, RotateCcw } from 'lucide-react';
import { TesterTable } from './TesterTable';

interface Tester {
  id: string;
  name: string;
  email?: string;
  token?: string;
  is_active?: boolean;
  created_at?: string;
}

interface TesterManagerProps {
  testers: Tester[];
  onTesterCreated: () => void;
}

type ConfirmAction = {
  type: 'deactivate' | 'regenerate';
  testerId: string;
};

export function TesterManager({ testers, onTesterCreated }: TesterManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [newTesterLink, setNewTesterLink] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');

  // ──────────────────────────────────────────────
  // Handlers
  // ──────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch('/api/admin/testers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          sendEmail: sendEmail && !!email.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create tester');
      }

      const { tester, emailSent } = await response.json();
      setNewTesterLink(`${baseUrl}/betatest/${tester.token}`);

      if (emailSent) {
        setSuccessMsg(`Tester created and invite email sent to ${email.trim()}`);
      } else {
        setSuccessMsg('Tester created successfully');
      }

      setName('');
      setEmail('');
      setSendEmail(true);
      setShowForm(false);
      onTesterCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsCreating(false);
    }
  };

  const copyLink = async (token: string) => {
    const link = `${baseUrl}/betatest/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeactivate = async (id: string) => {
    setActionLoading(id);
    setConfirmAction(null);
    try {
      const res = await fetch(`/api/admin/testers/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to deactivate');
      onTesterCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate tester');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/testers/${id}`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to reactivate');
      onTesterCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate tester');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerate = async (id: string) => {
    setActionLoading(id);
    setConfirmAction(null);
    try {
      const res = await fetch(`/api/admin/testers/${id}/regenerate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to regenerate link');
      const { emailSent } = await res.json();
      setSuccessMsg(
        emailSent
          ? 'Link regenerated and new invite email sent'
          : 'Link regenerated successfully',
      );
      onTesterCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate link');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendEmail = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/testers/${id}/resend`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to resend email');
      }
      setSuccessMsg('Invite email resent successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend email');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '\u2014';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const activeTesters = testers.filter((t) => t.is_active !== false);
  const inactiveTesters = testers.filter((t) => t.is_active === false);

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      {(successMsg || newTesterLink) && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-green-800">
                {successMsg || 'Tester created successfully!'}
              </p>
              {newTesterLink && (
                <>
                  <p className="text-sm text-green-700 mt-1">
                    Share this link with your tester:
                  </p>
                  <code className="block mt-2 p-2 bg-white rounded text-sm break-all">
                    {newTesterLink}
                  </code>
                </>
              )}
            </div>
            <button
              onClick={() => {
                if (newTesterLink) navigator.clipboard.writeText(newTesterLink);
                setNewTesterLink(null);
                setSuccessMsg(null);
              }}
              className="px-3 py-1 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 shrink-0"
            >
              {newTesterLink ? 'Copy & Close' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between">
          <p className="text-sm text-red-800">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">Beta Testers</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary hover:bg-primary/90"
        >
          {showForm ? (
            <>
              <X className="w-4 h-4" /> Cancel
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" /> Add Tester
            </>
          )}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="p-4 rounded-xl bg-surface-container border border-outline-variant"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="tester-name"
                className="block text-sm font-medium text-on-surface mb-1"
              >
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="tester-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                required
                className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label
                htmlFor="tester-email"
                className="block text-sm font-medium text-on-surface mb-1"
              >
                Email (optional)
              </label>
              <input
                id="tester-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Send email checkbox */}
          <div className="mt-3 flex items-center gap-2">
            <input
              id="send-email"
              type="checkbox"
              checked={sendEmail && !!email.trim()}
              disabled={!email.trim()}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="w-4 h-4 rounded border-outline text-primary focus:ring-primary"
            />
            <label
              htmlFor="send-email"
              className={`text-sm ${email.trim() ? 'text-on-surface' : 'text-on-surface-variant'}`}
            >
              Send invite email
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Tester'}
            </button>
          </div>
        </form>
      )}

      {/* Active Testers */}
      <TesterTable
        testers={activeTesters}
        copiedId={copiedId}
        actionLoading={actionLoading}
        confirmAction={confirmAction}
        onCopyLink={copyLink}
        onDeactivate={(id) => setConfirmAction({ type: 'deactivate', testerId: id })}
        onConfirmDeactivate={handleDeactivate}
        onRegenerate={(id) => setConfirmAction({ type: 'regenerate', testerId: id })}
        onConfirmRegenerate={handleRegenerate}
        onResendEmail={handleResendEmail}
        onCancelConfirm={() => setConfirmAction(null)}
        formatDate={formatDate}
      />

      {/* Inactive Testers */}
      {inactiveTesters.length > 0 && (
        <div className="opacity-60">
          <h3 className="text-sm font-medium text-on-surface-variant mb-2">
            Inactive ({inactiveTesters.length})
          </h3>
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
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {inactiveTesters.map((tester) => (
                  <tr key={tester.id}>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {tester.name}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {tester.email || '\u2014'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleReactivate(tester.id)}
                        disabled={actionLoading === tester.id}
                        className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg bg-surface-container-high text-on-surface hover:bg-primary/10 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3 h-3" />
                        {actionLoading === tester.id ? 'Reactivating...' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
