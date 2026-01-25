import { TrendingUp, TrendingDown } from 'lucide-react';
import type { ScoreType } from '../../hooks/useScoreData';
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';

interface SideScoreCardProps {
    type: ScoreType;
    score: number | null;
    /** 3-month change: points (scores API) or percent (metrics). Default 'points'. */
    trend?: number | null;
    trendUnit?: 'points' | 'percent';
    onClick: () => void;
    isActive?: boolean;
    className?: string;
}

const SCORE_CONFIG: Record<ScoreType, { label: string }> = {
    investoredge: { label: 'InvestorEdge' },
    homeready: { label: 'HomeReady' },
    market_health: { label: 'Market Health' }
};

export function SideScoreCard({ type, score, trend, trendUnit = 'points', onClick, isActive, className }: SideScoreCardProps) {
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

                    {/* Trend Text (3-month change from data binding layer) */}
                    <div className="text-[9px] text-on-surface-variant flex items-center gap-1">
                        {trend != null ? (
                            <>
                                {trend > 0 ? <TrendingUp className="w-2.5 h-2.5 text-green-600" /> : <TrendingDown className="w-2.5 h-2.5 text-red-500" />}
                                <span className={`font-medium ${trend > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {trendUnit === 'percent'
                                      ? `${Math.abs(trend).toFixed(0)}%`
                                      : `${trend >= 0 ? '+' : ''}${trend.toFixed(1)} pts`}
                                </span>
                                {trendUnit === 'percent' && <span className="truncate opacity-80">vs prev</span>}
                            </>
                        ) : (
                            <span className="opacity-50">--</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
