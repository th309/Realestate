import { TrendingUp, TrendingDown } from 'lucide-react';
import type { ScoreType } from '../../hooks/useScoreData';
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';
import { Sparkline } from '@/app/components/charts/Sparkline';

interface SideScoreCardProps {
    type: ScoreType;
    score: number | null;
    trend?: number | null;
    history?: { date: string; value: number }[];
    onClick: () => void;
    isActive?: boolean;
    className?: string;
    loading?: boolean;
}

const SCORE_CONFIG: Record<ScoreType, { label: string }> = {
    investoredge: { label: 'InvestorEdge' },
    homeready: { label: 'HomeReady' },
    market_health: { label: 'Market Health' }
};

export function SideScoreCard({ type, score, trend, history = [], onClick, isActive, className, loading = false }: SideScoreCardProps) {
    const config = SCORE_CONFIG[type];

    return (
        <div
            onClick={onClick}
            className={`
        bg-surface-container-low rounded-xl p-2.5 border transition-all cursor-pointer group
        hover:border-primary/50 hover:shadow-md flex flex-col justify-center
        ${isActive ? 'border-primary ring-1 ring-primary/20' : 'border-outline-variant'}
        ${className}
      `}
        >
            <div className="flex items-center gap-2.5">
                {/* Score Display */}
                {score !== null ? (
                    <div className="flex-shrink-0">
                        <ScoreDisplay
                            value={score}
                            size={48}
                            strokeWidth={4}
                            showLabel={false}
                        />
                    </div>
                ) : (
                    <div className="w-12 h-12 flex items-center justify-center rounded-full border-4 border-surface-container-highest flex-shrink-0">
                        <span className="text-sm text-on-surface-variant">--</span>
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wide block mb-0.5 truncate">
                        {config.label}
                    </span>

                    {/* Trend Text */}
                    <div className="text-[9px] text-on-surface-variant flex items-center gap-1">
                        {trend != null ? (
                            <>
                                {trend > 0 ? <TrendingUp className="w-2.5 h-2.5 text-green-600" /> : <TrendingDown className="w-2.5 h-2.5 text-red-500" />}
                                <span className={`font-medium ${trend > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {Math.abs(trend).toFixed(0)}%
                                </span>
                            </>
                        ) : (
                            <span className="opacity-50">--</span>
                        )}
                    </div>
                </div>

                {/* Tiny Sparkline */}
                {!loading && history.length > 0 && (
                    <div className="w-12 h-6 opacity-60">
                        <Sparkline
                            data={history}
                            color={trend != null && trend > 0 ? '#16a34a' : trend != null && trend < 0 ? '#ef4444' : '#6750a4'}
                            strokeWidth={1.5}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
