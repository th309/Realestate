import { TrendingUp, TrendingDown } from 'lucide-react';
import type { ScoreType } from '../../hooks/useScoreData';
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';

interface SideScoreCardProps {
    type: ScoreType;
    score: number | null;
    trend?: number | null;
    onClick: () => void;
    isActive?: boolean;
}

const SCORE_CONFIG: Record<ScoreType, { label: string }> = {
    investoredge: { label: 'InvestorEdge' },
    homeready: { label: 'HomeReady' },
    market_health: { label: 'Market Health' }
};

export function SideScoreCard({ type, score, trend, onClick, isActive }: SideScoreCardProps) {
    const config = SCORE_CONFIG[type];

    return (
        <div
            onClick={onClick}
            className={`
        bg-surface-container-low rounded-xl p-3 border transition-all cursor-pointer group
        hover:border-primary/50 hover:shadow-md
        ${isActive ? 'border-primary ring-1 ring-primary/20' : 'border-outline-variant'}
      `}
        >
            <div className="flex items-center gap-3">
                {/* Score Display */}
                {score !== null ? (
                    <ScoreDisplay
                        value={score}
                        size={56}
                        strokeWidth={4}
                        showLabel={false}
                    />
                ) : (
                    <div className="w-14 h-14 flex items-center justify-center rounded-full border-4 border-surface-container-highest">
                        <span className="text-lg text-on-surface-variant">--</span>
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wide block mb-1">
                        {config.label}
                    </span>

                    {/* Trend Text */}
                    <div className="text-[10px] text-on-surface-variant flex items-center gap-1">
                        {trend != null ? (
                            <>
                                {trend > 0 ? <TrendingUp className="w-3 h-3 text-green-600" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
                                <span className={trend > 0 ? 'text-green-600' : 'text-red-500'}>
                                    {Math.abs(trend).toFixed(1)}%
                                </span>
                                <span>vs last month</span>
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
