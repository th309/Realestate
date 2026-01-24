import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import type { ScoreType, ConfidenceLevel } from '../../hooks/useScoreData';
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';

interface ScoreGaugeCardProps {
    type: ScoreType;
    score: number | null;
    confidenceLevel?: ConfidenceLevel;
    trend?: number | null;
    loading?: boolean;
}

const SCORE_LABELS: Record<ScoreType, { title: string; desc: string }> = {
    investoredge: {
        title: 'InvestorEdge Score',
        desc: 'Investment potential based on yields, appreciation, and risk factors.'
    },
    homeready: {
        title: 'HomeReady Score',
        desc: 'Buyer opportunity score based on pricing, inventory, and market dynamics.'
    },
    market_health: {
        title: 'Market Health Score',
        desc: 'Overall stability and robustness of the local real estate market.'
    }
};

const CONFIDENCE_COLORS: Record<ConfidenceLevel, { bg: string; text: string }> = {
    high: { bg: 'bg-green-500', text: 'text-white' },
    medium: { bg: 'bg-amber-500', text: 'text-white' },
    low: { bg: 'bg-orange-500', text: 'text-white' },
    insufficient: { bg: 'bg-red-500', text: 'text-white' }
};

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
    high: 'HIGH',
    medium: 'MED',
    low: 'LOW',
    insufficient: 'N/A'
};

export function ScoreGaugeCard({ type, score, confidenceLevel = 'medium', trend, loading = false }: ScoreGaugeCardProps) {
    const config = SCORE_LABELS[type];
    const currentScore = score ?? 0;
    const confColors = CONFIDENCE_COLORS[confidenceLevel];

    return (
        <div className="flex-1 bg-surface-container-low rounded-2xl p-4 flex flex-col items-center border border-outline-variant overflow-hidden">
            {/* Score Display */}
            <div className="mt-4">
                {loading ? (
                    <div className="w-[160px] h-[160px] flex items-center justify-center">
                        <Loader2 className="w-10 h-10 animate-spin text-on-surface-variant" />
                    </div>
                ) : (
                    <ScoreDisplay
                        value={currentScore}
                        size={160}
                        strokeWidth={10}
                    />
                )}
            </div>

            {/* Trend */}
            {trend != null && !loading && (
                <div className={`flex items-center gap-1 mt-1 text-sm font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
                </div>
            )}

            {/* Score Label */}
            <h3 className="text-base font-bold text-on-surface mt-2">{config.title}</h3>
            <p className="text-[10px] leading-tight text-on-surface-variant text-center mt-1.5 max-w-[180px]">
                {config.desc}
            </p>

        </div>
    );
}
