import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import type { ScoreType, ConfidenceLevel } from '../../hooks/useScoreData';
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';
import { Sparkline } from '@/app/components/charts/Sparkline';

export interface ScoreIndicator {
    metricId: string;
    label: string;
    formattedValue: string;
    trend: {
        direction: 'up' | 'down' | 'flat' | null;
        label: string | null;
    };
    history: { date: string; value: number }[];
}

interface ScoreGaugeCardProps {
    type: ScoreType;
    score: number | null;
    confidenceLevel?: ConfidenceLevel;
    trend?: {
        direction: 'up' | 'down' | 'flat' | null;
        label: string | null;
    } | null;
    history?: { date: string; value: number }[]; // Added for sparkline
    indicators?: ScoreIndicator[];
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

export function ScoreGaugeCard({ type, score, confidenceLevel = 'medium', trend, history = [], indicators = [], loading = false }: ScoreGaugeCardProps) {
    const config = SCORE_LABELS[type];
    const currentScore = score ?? 0;

    return (
        <div className="bg-surface-container-low rounded-3xl p-6 flex flex-col border border-outline-variant overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-on-surface">{config.title}</h3>
                    <p className="text-xs text-on-surface-variant max-w-[200px] mt-1">
                        {config.desc}
                    </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                    {/* Main Trend */}
                    {trend != null && !loading && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${trend.direction === 'up' ? 'text-green-600 bg-green-50 border-green-100' :
                            trend.direction === 'down' ? 'text-red-600 bg-red-50 border-red-100' :
                                'text-on-surface-variant bg-surface-variant border-outline-variant'
                            }`}>
                            {trend.direction === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : trend.direction === 'down' ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                            {trend.label || '--'}
                        </div>
                    )}

                    {/* Sparkline for Score History */}
                    {!loading && history.length > 0 && (
                        <div className="w-32 h-10 mt-1 opacity-80">
                            <Sparkline
                                data={history}
                                color={trend?.direction === 'up' ? '#16a34a' : trend?.direction === 'down' ? '#ef4444' : '#6750a4'}
                                strokeWidth={2.5}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Score Display */}
                <div className="relative">
                    {loading ? (
                        <div className="w-[180px] h-[180px] flex items-center justify-center">
                            <Loader2 className="w-12 h-12 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="relative group">
                            <ScoreDisplay
                                value={currentScore}
                                size={180}
                                strokeWidth={12}
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-xs font-bold text-on-surface-variant opacity-50 uppercase tracking-widest mb-1">Score</span>
                                <span className="text-4xl font-black text-on-surface">{currentScore}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sub-Metrics Grid */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                    {indicators.map((ind) => (
                        <div key={ind.metricId} className="bg-surface p-3 rounded-2xl border border-outline-variant hover:border-primary/30 transition-colors">
                            <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 truncate">
                                {ind.label}
                            </div>
                            <div className="flex items-baseline justify-between gap-1">
                                <span className="text-base font-bold text-on-surface truncate">
                                    {loading ? '...' : ind.formattedValue}
                                </span>
                                {ind.trend.direction && (
                                    <span className={`text-[10px] font-bold flex items-center gap-0.5 ${ind.trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                                        {ind.trend.direction === 'up' ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                        {ind.trend.label}
                                    </span>
                                )}
                            </div>

                            {/* Indicator Sparkline */}
                            {!loading && ind.history.length > 0 && (
                                <div className="h-6 mt-2 opacity-60">
                                    <Sparkline
                                        data={ind.history}
                                        color={ind.trend.direction === 'up' ? '#16a34a' : ind.trend.direction === 'down' ? '#ef4444' : '#6750a4'}
                                        strokeWidth={1.2}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
