/**
 * Tester Manager Component
 * 
 * Create and manage beta testers with shareable links.
 */

'use client';

import { useState } from 'react';

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

export function TesterManager({ testers, onTesterCreated }: TesterManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTesterLink, setNewTesterLink] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch('/api/admin/testers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create tester');
      }

      const { tester } = await response.json();
      const baseUrl = window.location.origin;
      setNewTesterLink(`${baseUrl}/betatest/${tester.token}`);
      setName('');
      setEmail('');
      setShowForm(false);
      onTesterCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsCreating(false);
    }
  };

  const copyLink = async (token: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/betatest/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      {newTesterLink && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-green-800">Tester created successfully!</p>
              <p className="text-sm text-green-700 mt-1">Share this link with your tester:</p>
              <code className="block mt-2 p-2 bg-white rounded text-sm break-all">
                {newTesterLink}
              </code>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newTesterLink);
                setNewTesterLink(null);
              }}
              className="px-3 py-1 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              Copy & Close
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-on-surface">Beta Testers</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary hover:bg-primary/90"
        >
          {showForm ? 'Cancel' : 'Add Tester'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="p-4 rounded-xl bg-surface-container border border-outline-variant">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tester-name" className="block text-sm font-medium text-on-surface mb-1">
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
              <label htmlFor="tester-email" className="block text-sm font-medium text-on-surface mb-1">
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
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
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

      {/* Testers List */}
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
                Link
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {testers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-on-surface-variant">
                  No testers yet. Click "Add Tester" to create one.
                </td>
              </tr>
            ) : (
              testers.map((tester) => (
                <tr key={tester.id} className="hover:bg-surface-container-high">
                  <td className="px-4 py-3">
                    <span className="font-medium text-on-surface">{tester.name}</span>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {tester.email || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {formatDate(tester.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {tester.token && (
                      <button
                        onClick={() => copyLink(tester.token!)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                          copiedId === tester.token
                            ? 'bg-green-100 text-green-800'
                            : 'bg-surface-container-high text-on-surface hover:bg-primary/10'
                        }`}
                      >
                        {copiedId === tester.token ? 'Copied!' : 'Copy Link'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
