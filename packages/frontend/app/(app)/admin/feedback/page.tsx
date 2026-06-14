/**
 * Admin Feedback Dashboard
 * 
 * View and manage all beta feedback submissions.
 * Supports filtering, status updates, and IDE export.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { FeedbackTable } from './components/FeedbackTable';
import { FeedbackFilters } from './components/FeedbackFilters';
import { FeedbackStats } from './components/FeedbackStats';
import { ExportButton } from './components/ExportButton';
import { TesterManager } from './components/TesterManager';
import type { FeedbackWithTester, FeedbackStatus, FeedbackCategory } from '../../betatest/types';

type TabId = 'feedback' | 'testers';

interface FilterState {
  status: FeedbackStatus | 'all';
  category: FeedbackCategory | 'all';
  testerId: string | 'all';
}

export default function AdminFeedbackPage() {
  const [activeTab, setActiveTab] = useState<TabId>('feedback');
  const [feedback, setFeedback] = useState<FeedbackWithTester[]>([]);
  const [testers, setTesters] = useState<{ id: string; name: string; email?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    category: 'all',
    testerId: 'all',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [feedbackRes, testersRes] = await Promise.all([
        fetch('/api/admin/feedback', { credentials: 'include' }),
        fetch('/api/admin/testers', { credentials: 'include' }),
      ]);

      if (!feedbackRes.ok || !testersRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [feedbackData, testersData] = await Promise.all([
        feedbackRes.json(),
        testersRes.json(),
      ]);

      setFeedback(feedbackData.feedback || []);
      setTesters(testersData.testers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredFeedback = feedback.filter((item) => {
    if (filters.status !== 'all' && item.status !== filters.status) return false;
    if (filters.category !== 'all' && item.category !== filters.category) return false;
    if (filters.testerId !== 'all' && item.tester_id !== filters.testerId) return false;
    return true;
  });

  const handleStatusUpdate = async (feedbackId: string, newStatus: FeedbackStatus) => {
    try {
      const response = await fetch(`/api/admin/feedback/${feedbackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      setFeedback(prev => 
        prev.map(f => f.id === feedbackId ? { ...f, status: newStatus } : f)
      );
    } catch (err) {
      console.error('Status update error:', err);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredFeedback.map(f => f.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const selectedFeedback = feedback.filter(f => selectedIds.has(f.id));

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-surface-container border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-on-surface">
                Beta Feedback
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Manage beta tester feedback and export for development
              </p>
            </div>
            <div className="flex items-center gap-4">
              {selectedIds.size > 0 && (
                <ExportButton feedback={selectedFeedback} />
              )}
              <button
                onClick={fetchData}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <FeedbackStats feedback={feedback} />
        </div>
      </div>

      {/* Tab Navigation */}
      <nav className="bg-surface border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('feedback')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'feedback'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Feedback ({feedback.length})
            </button>
            <button
              onClick={() => setActiveTab('testers')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'testers'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Testers ({testers.length})
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {activeTab === 'feedback' ? (
          <div className="space-y-4">
            <FeedbackFilters
              filters={filters}
              onFilterChange={setFilters}
              testers={testers}
            />
            <FeedbackTable
              feedback={filteredFeedback}
              loading={loading}
              selectedIds={selectedIds}
              onSelectAll={handleSelectAll}
              onSelectOne={handleSelectOne}
              onStatusUpdate={handleStatusUpdate}
            />
          </div>
        ) : (
          <TesterManager 
            testers={testers} 
            onTesterCreated={fetchData}
          />
        )}
      </main>
    </div>
  );
}
