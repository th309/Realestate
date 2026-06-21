"use client";

import { Newspaper } from "lucide-react";
import { type MarketBundle, shortMarketName } from "./marketBundles";

/** Pull the news array out of a market's (loosely-typed) realtime block. */
function newsItems(realtime: unknown): Array<Record<string, unknown>> {
  const r = realtime as { news?: unknown } | null;
  return Array.isArray(r?.news)
    ? (r!.news as Array<Record<string, unknown>>)
    : [];
}

/**
 * ComparisonNews — recent news for EVERY market in the comparison, grouped by
 * market. Replaces the single-market Market Pulse in the synthesis (which only
 * showed the primary's news). Each market's news comes from its own
 * `bundle.realtime`, so the head-to-head reflects all markets, not just Chicago.
 */
export function ComparisonNews({ markets }: { markets: MarketBundle[] }) {
  const withNews = markets
    .map((m) => ({ market: m, items: newsItems(m.realtime).slice(0, 3) }))
    .filter((x) => x.items.length > 0);

  if (withNews.length === 0) return null;

  const cols = withNews.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <div className="report-section">
      <h2 className="report-heading-lg mb-1 flex items-center gap-2 text-on-surface">
        <Newspaper className="h-5 w-5 text-primary" />
        Recent news across markets
      </h2>
      <p className="mb-4 text-sm text-on-surface-variant">
        The latest signals for each market being compared.
      </p>
      <div className={`grid grid-cols-1 gap-5 ${cols}`}>
        {withNews.map(({ market, items }) => (
          <div
            key={market.id}
            className="rounded-2xl border border-outline-variant bg-surface-container p-4"
          >
            <p className="mb-2 text-sm font-semibold text-on-surface">
              {shortMarketName(market.name)}
            </p>
            <ul className="space-y-2.5">
              {items.map((it, i) => {
                const title = (it.title ?? it.headline ?? "") as string;
                if (!title) return null;
                const source = (it.source ?? it.publisher ?? "") as string;
                const url = (it.url ?? it.link) as string | undefined;
                return (
                  <li key={i} className="text-[12.5px] leading-snug">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-on-surface hover:text-primary"
                      >
                        {title}
                      </a>
                    ) : (
                      <span className="font-medium text-on-surface">
                        {title}
                      </span>
                    )}
                    {source && (
                      <span className="text-on-surface-variant">
                        {" "}
                        · {source}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
