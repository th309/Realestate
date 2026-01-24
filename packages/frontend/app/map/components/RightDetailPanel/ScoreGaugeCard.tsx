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
        <div className="flex-1 bg-surface-container-low rounded-2xl p-6 flex flex-col items-center border border-outline-variant">
            {/* Confidence Badge */}
            <div className="self-end mb-2">
                <span className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wide">Confidence</span>
                <div className={`${confColors.bg} ${confColors.text} px-2 py-1 rounded-full flex items-center justify-center font-bold text-[10px] mt-1`}>
                    {CONFIDENCE_LABELS[confidenceLevel]}
                </div>
            </div>

            {/* Score Display */}
            {loading ? (
                <div className="w-[180px] h-[180px] flex items-center justify-center">
                    <Loader2 className="w-12 h-12 animate-spin text-on-surface-variant" />
                </div>
            ) : (
                <ScoreDisplay
                    value={currentScore}
                    size={180}
                    strokeWidth={12}
                />
            )}

            {/* Trend */}
            {trend != null && !loading && (
                <div className={`flex items-center gap-1 mt-2 text-sm font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
                </div>
            )}

            {/* Score Label */}
            <h3 className="text-lg font-bold text-on-surface mt-4">{config.title}</h3>
            <p className="text-xs text-on-surface-variant text-center mt-2 max-w-[200px]">
                {config.desc}
            </p>

            <button className="mt-4 text-primary text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                View Calculation Methodology
                <span>→</span>
            </button>
        </div>
    );
}
