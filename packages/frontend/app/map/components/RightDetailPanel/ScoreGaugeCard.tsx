import { TrendingUp, TrendingDown } from 'lucide-react';
import type { ScoreType } from '../../hooks/useScoreData';

interface ScoreGaugeCardProps {
    type: ScoreType;
    score: number | null;
    confidence: string; // 'A' | 'B' | 'C' etc
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

function getScoreColor(value: number): string {
    const percentage = Math.min(Math.max(value / 100, 0), 1);
    const hue = percentage * 120;
    return `hsl(${hue}, 70%, 45%)`;
}

export function ScoreGaugeCard({ type, score, confidence, trend, loading = false }: ScoreGaugeCardProps) {
    const config = SCORE_LABELS[type];
    const size = 180;
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const currentScore = score ?? 0;
    const percentage = Math.min(currentScore / 100, 1);
    const strokeDashoffset = circumference - percentage * circumference;
    const strokeColor = getScoreColor(currentScore);

    return (
        <div className="flex-1 bg-surface-container-low rounded-2xl p-6 flex flex-col items-center border border-outline-variant">
            {/* Confidence Badge */}
            <div className="self-end mb-2">
                <span className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wide">Confidence</span>
                <div className="bg-primary text-on-primary w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mt-1">
                    {confidence}
                </div>
            </div>

            {/* Gauge */}
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="transform -rotate-90">
                    <circle
                        cx={size / 2} cy={size / 2} r={radius}
                        fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth}
                    />
                    {!loading && (
                        <circle
                            cx={size / 2} cy={size / 2} r={radius}
                            fill="none" stroke={strokeColor} strokeWidth={strokeWidth}
                            strokeLinecap="round" strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-700 ease-out"
                        />
                    )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-bold text-on-surface">
                        {loading ? '--' : Math.round(currentScore)}
                    </span>
                    {trend != null && !loading && (
                        <div className={`flex items-center gap-1 mt-1 text-sm font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
                        </div>
                    )}
                </div>
            </div>

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
