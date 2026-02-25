'use client';

import { useEffect, useState } from 'react';
import { fetchAPIRaw } from '@/lib/data';
import { Target, TrendingUp, CheckCircle, Circle } from 'lucide-react';

interface MilestoneStatus {
  target: number;
  label: string;
  reached: boolean;
  reachedAt?: string;
  projectedDate?: string;
}

interface GrowthProgressData {
  goal: {
    targetPaidUsers: number;
    targetDate: string;
    isActive: boolean;
  };
  currentPaidUsers: number;
  daysRemaining: number;
  currentGrowthRate: number;
  requiredGrowthRate: number;
  milestoneProgress: MilestoneStatus[];
}

export function GoalProgressWidget() {
  const [data, setData] = useState<GrowthProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProgress() {
      try {
        const response = await fetchAPIRaw('/api/admin/analytics/growth-progress');
        if (response.ok) {
          setData(await response.json());
        }
      } catch {
        // Silently fail — widget is supplementary
      } finally {
        setLoading(false);
      }
    }
    fetchProgress();
  }, []);

  if (loading) {
    return (
      <div className="bg-surface-container rounded-xl p-6 border border-outline-variant animate-pulse">
        <div className="h-6 bg-surface-container-high rounded w-1/3 mb-4" />
        <div className="h-4 bg-surface-container-high rounded w-full mb-2" />
        <div className="h-4 bg-surface-container-high rounded w-2/3" />
      </div>
    );
  }

  if (!data || !data.goal.isActive) return null;

  const progressPercent = Math.min(
    100,
    (data.currentPaidUsers / data.goal.targetPaidUsers) * 100,
  );
  const gapMultiplier =
    data.currentGrowthRate > 0
      ? data.requiredGrowthRate / data.currentGrowthRate
      : Infinity;

  return (
    <div className="bg-surface-container rounded-xl p-6 border border-outline-variant">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-medium text-on-surface">
            Goal: {data.goal.targetPaidUsers.toLocaleString()} Paid Users by{' '}
            {new Date(data.goal.targetDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </h3>
        </div>
        <span className="text-sm text-on-surface-variant">
          {data.daysRemaining} days remaining
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-on-surface font-medium">
            {data.currentPaidUsers} paid users
          </span>
          <span className="text-on-surface-variant">
            {progressPercent.toFixed(1)}%
          </span>
        </div>
        <div className="h-3 bg-surface-container-high rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Milestones */}
      <div className="flex flex-wrap gap-3 mb-4">
        {data.milestoneProgress.map((m) => (
          <div
            key={m.target}
            className={`flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border ${
              m.reached
                ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400'
                : 'bg-surface border-outline-variant text-on-surface-variant'
            }`}
          >
            {m.reached ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <Circle className="w-3.5 h-3.5" />
            )}
            <span>{m.target.toLocaleString()}</span>
            {m.reached && m.reachedAt && (
              <span className="text-xs opacity-75">
                {new Date(m.reachedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
            {!m.reached && m.projectedDate && (
              <span className="text-xs opacity-75">
                ~{new Date(m.projectedDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Growth rate */}
      <div className="flex items-center gap-4 text-sm text-on-surface-variant">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-4 h-4" />
          <span>
            Growth: <strong>{data.currentGrowthRate}</strong>/day (30d avg)
          </span>
        </div>
        <span>|</span>
        <span>
          Need: <strong>{data.requiredGrowthRate}</strong>/day
        </span>
        {gapMultiplier > 1 && isFinite(gapMultiplier) && (
          <>
            <span>|</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {gapMultiplier.toFixed(1)}x acceleration needed
            </span>
          </>
        )}
      </div>
    </div>
  );
}
