import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { extractMarketFromTags } from "@/lib/blog/extract-market";

interface BlogMarketCTAProps {
  tags: string[];
}

export function BlogMarketCTA({ tags }: BlogMarketCTAProps) {
  const market = extractMarketFromTags(tags);
  if (!market) return null;

  return (
    <div className="mt-10 mb-8 rounded-xl bg-primary/5 border border-primary/15 p-6">
      <div className="flex items-start gap-3 mb-3">
        <BarChart3 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-lg font-semibold text-on-surface">
            Explore {market.city} on PropertyIQ
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">
            See live scores, AI reports, and 50+ metrics for this market —
            updated monthly.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mt-4 ml-8">
        <Link
          href={`/markets/${market.slug}`}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Explore {market.city} →
        </Link>
        <Link
          href="/auth/sign-up"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors"
        >
          Try Free — No Credit Card
        </Link>
      </div>
    </div>
  );
}
