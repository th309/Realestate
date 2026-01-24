import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ScoreType } from '../../hooks/useScoreData';

interface SideScoreCardProps {
    type: ScoreType;
    score: number | null;
    trend?: number | null;
    onClick: () => void;
    isActive?: boolean;
}

const SCORE_CONFIG: Record<ScoreType, { label: string; iconColor: string }> = {
    investoredge: { label: 'InvestorEdge', iconColor: 'text-primary' },
    homeready: { label: 'HomeReady', iconColor: 'text-secondary' },
    market_health: { label: 'Market Health', iconColor: 'text-green-600' }
};

export function SideScoreCard({ type, score, trend, onClick, isActive }: SideScoreCardProps) {
    const config = SCORE_CONFIG[type];

    // Grade color logic
    const getGradeColor = (s: number) => {
        if (s >= 80) return 'bg-green-500';
        if (s >= 60) return 'bg-amber-500';
        return 'bg-red-500';
    };

    return (
        <div
            onClick={onClick}
            className={`
        bg-surface-container-low rounded-xl p-4 border transition-all cursor-pointer group
        hover:border-primary/50 hover:shadow-md
        ${isActive ? 'border-primary ring-1 ring-primary/20' : 'border-outline-variant'}
      `}
        >
            <div className="flex items-start justify-between">
                <div>
                    <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wide block mb-1">
                        {config.label}
                    </span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-on-surface">
                            {score !== null ? Math.round(score) : '--'}
                        </span>
                        {score !== null && (
                            <div className={`w-2 h-2 rounded-full ${getGradeColor(score)}`} />
                        )}
                    </div>
                </div>

                {/* Mini Trend Graph representation or icon */}
                <div className={`w-8 h-8 rounded-lg bg-surface flex items-center justify-center ${config.iconColor} bg-opacity-10`}>
                    <TrendingUp className="w-4 h-4" />
                </div>
            </div>

            {/* Trend Text */}
            <div className="mt-2 text-[10px] text-on-surface-variant flex items-center gap-1">
                {trend != null ? (
                    <>
                        {trend > 0 ? <TrendingUp className="w-3 h-3 text-green-600" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
                        <span className={trend > 0 ? 'text-green-600' : 'text-red-500'}>
                            {Math.abs(trend).toFixed(1)}%
                        </span>
                        <span>vs last month</span>
                    </>
                ) : (
                    <span className="opacity-50">Trend unavailable</span>
                )}
            </div>
        </div>
    );
}
