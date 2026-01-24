import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

interface InsightCarouselProps {
    geographyName: string;
    investorScore: number | null;
    homeReadyScore: number | null;
    marketHealthScore: number | null;
    viewMode: 'investor' | 'homebuyer';
}

export function InsightCarousel({
    geographyName,
    investorScore,
    homeReadyScore,
    marketHealthScore,
    viewMode
}: InsightCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Generate dynamic insights based on scores
    const getInvestorInsight = () => {
        const score = investorScore ?? 0;
        const health = marketHealthScore ?? 0;

        let text = `${geographyName} presents `;
        if (score >= 80) text += "exceptional short-term rental potential with high yield indicators. ";
        else if (score >= 60) text += "moderate investment opportunities, primarily for long-term holds. ";
        else text += "challenging constraints for immediate cash flow. ";

        if (health >= 70) text += "Market fundamentals remain robust with strong demand.";
        else text += "Monitor local inventory trends carefully before entering.";

        return text;
    };

    const getBuyerInsight = () => {
        const score = homeReadyScore ?? 0;

        let text = `${geographyName} is `;
        if (score >= 75) text += "currently a buyer-friendly market with softening prices. ";
        else if (score >= 50) text += "highly competitive; prepared offers are essential. ";
        else text += "dominated by sellers; expect low inventory and bidding wars. ";

        text += "Mortgage readiness factors are performing " + (score > 60 ? "above" : "below") + " regional averages.";
        return text;
    };

    const insights = [
        {
            type: 'investor',
            title: 'Investor Insight',
            text: getInvestorInsight(),
            color: 'text-primary',
            bg: 'from-primary/10 to-transparent'
        },
        {
            type: 'buyer',
            title: 'Home Buyer/Renter Insight',
            text: getBuyerInsight(),
            color: 'text-secondary',
            bg: 'from-secondary/10 to-transparent'
        }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % insights.length);
        }, 8000); // Rotate every 8 seconds

        return () => clearInterval(interval);
    }, [insights.length]);

    const current = insights[currentIndex];

    return (
        <div className={`
      relative overflow-hidden rounded-xl p-4 border border-outline-variant
      bg-gradient-to-br transition-colors duration-500
      ${current.bg}
    `}>
            <div className="flex items-center gap-2 mb-2">
                <Sparkles className={`w-4 h-4 ${current.color}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${current.color}`}>
                    {current.title}
                </span>
            </div>

            <div className="min-h-[60px] relative">
                <p
                    key={currentIndex}
                    className="text-xs text-on-surface leading-relaxed animate-in fade-in slide-in-from-right-4 duration-500"
                >
                    "{current.text}"
                </p>
            </div>

            {/* Indicators */}
            <div className="flex gap-1 mt-2 justify-center">
                {insights.map((_, idx) => (
                    <div
                        key={idx}
                        className={`
              h-1 rounded-full transition-all duration-300
              ${idx === currentIndex ? `w-4 ${current.color.replace('text-', 'bg-')}` : 'w-1 bg-outline-variant'}
            `}
                    />
                ))}
            </div>
        </div>
    );
}
