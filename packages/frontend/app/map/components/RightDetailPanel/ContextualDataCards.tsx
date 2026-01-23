/**
 * ContextualDataCards Component
 *
 * Displays contextual market data cards:
 * - Pricing Momentum card with progress bar
 * - Inventory Levels card with progress bar
 * - Investment Insight card with highlighted tip
 *
 * Material Design 3 compliant.
 */

'use client';

import { memo } from 'react';

interface DataCardProps {
  title: string;
  value: string;
  progress?: number; // 0-100
  progressColor?: 'emerald' | 'amber' | 'rose' | 'primary';
  description?: string;
  icon: React.ReactNode;
}

/**
 * Individual data card with progress bar
 */
function DataCard({ title, value, progress, progressColor = 'primary', description, icon }: DataCardProps) {
  const progressColorClasses = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    primary: 'bg-primary',
  };

  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-4 border border-outline-variant flex-1">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            {title}
          </h4>
          <p className="text-xl font-black mt-1 text-on-surface">{value}</p>
        </div>
        <span className="bg-primary/10 p-2 rounded-lg text-primary">
          {icon}
        </span>
      </div>
      {progress !== undefined && (
        <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden mb-2">
          <div
            className={`h-full ${progressColorClasses[progressColor]} transition-all duration-500`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {description && (
        <p className="text-xs text-on-surface-variant">{description}</p>
      )}
    </div>
  );
}

interface InsightCardProps {
  title: string;
  insight: string;
}

/**
 * Investment insight highlight card
 */
function InsightCard({ title, insight }: InsightCardProps) {
  return (
    <div className="bg-primary rounded-xl shadow-md p-4 text-on-primary relative overflow-hidden">
      <div className="relative z-10">
        <h4 className="text-xs font-bold text-on-primary/70 uppercase tracking-widest mb-3">
          {title}
        </h4>
        <p className="text-sm font-medium leading-relaxed">
          "{insight}"
        </p>
      </div>
      {/* Decorative elements */}
      <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
      <div className="absolute right-10 top-2 w-10 h-10 bg-white/5 rounded-full" />
    </div>
  );
}

// Icons
function PaymentsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function InventoryIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

export interface PricingData {
  medianPrice: string;
  progress: number;
  changeDescription: string;
}

export interface InventoryData {
  supplyMonths: string;
  level: 'Low' | 'Medium' | 'High';
  progress: number;
  description: string;
}

export interface InsightData {
  text: string;
}

interface ContextualDataCardsProps {
  pricing?: PricingData;
  inventory?: InventoryData;
  insight?: InsightData;
  isLoading?: boolean;
}

/**
 * Loading skeleton for contextual cards
 */
function CardsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2].map((i) => (
        <div key={i} className="bg-surface-container-low rounded-xl p-4 border border-outline-variant animate-pulse">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="h-3 w-24 bg-surface-container-highest rounded mb-2" />
              <div className="h-6 w-20 bg-surface-container-highest rounded" />
            </div>
            <div className="w-9 h-9 bg-surface-container-highest rounded-lg" />
          </div>
          <div className="h-1.5 w-full bg-surface-container-highest rounded-full mb-2" />
          <div className="h-3 w-48 bg-surface-container-highest rounded" />
        </div>
      ))}
      <div className="bg-primary/20 rounded-xl p-4 animate-pulse">
        <div className="h-3 w-28 bg-primary/30 rounded mb-3" />
        <div className="h-4 w-full bg-primary/30 rounded mb-2" />
        <div className="h-4 w-3/4 bg-primary/30 rounded" />
      </div>
    </div>
  );
}

export const ContextualDataCards = memo(function ContextualDataCards({
  pricing,
  inventory,
  insight,
  isLoading = false,
}: ContextualDataCardsProps) {
  if (isLoading) {
    return <CardsSkeleton />;
  }

  // Determine inventory progress color
  const getInventoryColor = (level: string): 'emerald' | 'amber' | 'rose' => {
    switch (level) {
      case 'Low':
        return 'amber';
      case 'High':
        return 'emerald';
      default:
        return 'primary' as 'emerald';
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {pricing && (
        <DataCard
          title="Pricing Momentum"
          value={pricing.medianPrice}
          progress={pricing.progress}
          progressColor="emerald"
          description={pricing.changeDescription}
          icon={<PaymentsIcon />}
        />
      )}

      {inventory && (
        <DataCard
          title="Inventory Levels"
          value={`${inventory.level} (${inventory.supplyMonths})`}
          progress={inventory.progress}
          progressColor={getInventoryColor(inventory.level)}
          description={inventory.description}
          icon={<InventoryIcon />}
        />
      )}

      {insight && (
        <InsightCard
          title="Investment Insight"
          insight={insight.text}
        />
      )}
    </div>
  );
});

export default ContextualDataCards;
