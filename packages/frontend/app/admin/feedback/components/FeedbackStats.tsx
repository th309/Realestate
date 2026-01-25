/**
 * Feedback Stats Component
 * 
 * Displays summary statistics for feedback items.
 */

'use client';

import type { FeedbackWithTester } from '../../../betatest/types';

interface FeedbackStatsProps {
  feedback: FeedbackWithTester[];
}

export function FeedbackStats({ feedback }: FeedbackStatsProps) {
  const stats = {
    total: feedback.length,
    submitted: feedback.filter(f => f.status === 'submitted').length,
    inProgress: feedback.filter(f => f.status === 'triaged' || f.status === 'in_progress').length,
    fixed: feedback.filter(f => f.status === 'fixed' || f.status === 'deployed').length,
    bugs: feedback.filter(f => f.category === 'bug').length,
    critical: feedback.filter(f => f.severity === 'critical' || f.severity === 'high').length,
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard label="Total" value={stats.total} />
      <StatCard label="New" value={stats.submitted} color="bg-blue-50 text-blue-800" />
      <StatCard label="In Progress" value={stats.inProgress} color="bg-purple-50 text-purple-800" />
      <StatCard label="Fixed" value={stats.fixed} color="bg-green-50 text-green-800" />
      <StatCard label="Bugs" value={stats.bugs} color="bg-red-50 text-red-800" />
      <StatCard label="High Priority" value={stats.critical} color="bg-orange-50 text-orange-800" />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color?: string;
}

function StatCard({ label, value, color = 'bg-surface-container text-on-surface' }: StatCardProps) {
  return (
    <div className={`rounded-xl px-4 py-3 ${color}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm opacity-80">{label}</div>
    </div>
  );
}
