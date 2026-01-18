'use client';

import React from 'react';
import { Newspaper, ExternalLink, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface NewsItem {
  headline: string;
  summary: string;
  source: string;
  url?: string;
  published_at?: string;
  category: string;
  relevance_score: number;
}

interface MarketSentiment {
  sentiment: 'bullish' | 'neutral' | 'bearish';
  confidence: number;
  summary: string;
  factors: string[];
}

interface NewsSectionProps {
  news: NewsItem[];
  sentiment?: MarketSentiment | null;
  fetchedAt?: string;
}

function getCategoryColor(category: string) {
  switch (category.toLowerCase()) {
    case 'real_estate':
    case 'housing':
      return 'bg-blue-500/10 text-blue-600';
    case 'economy':
      return 'bg-green-500/10 text-green-600';
    case 'development':
      return 'bg-purple-500/10 text-purple-600';
    case 'policy':
      return 'bg-amber-500/10 text-amber-600';
    default:
      return 'bg-gray-500/10 text-gray-600';
  }
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div className="bg-surface rounded-2xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${getCategoryColor(item.category)}`}
        >
          {item.category.replace('_', ' ')}
        </span>
        <span className="text-xs text-on-surface-variant">
          {Math.round(item.relevance_score * 100)}% relevant
        </span>
      </div>

      <h4 className="font-medium text-on-surface mb-2 line-clamp-2">{item.headline}</h4>

      <p className="text-sm text-on-surface-variant line-clamp-2 mb-3">{item.summary}</p>

      <div className="flex items-center justify-between text-xs text-on-surface-variant">
        <span>{item.source}</span>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Read more
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function SentimentCard({ sentiment }: { sentiment: MarketSentiment }) {
  const TrendIcon =
    sentiment.sentiment === 'bullish'
      ? TrendingUp
      : sentiment.sentiment === 'bearish'
        ? TrendingDown
        : Minus;

  const sentimentColors = {
    bullish: 'border-green-500/30 bg-green-500/5',
    neutral: 'border-amber-500/30 bg-amber-500/5',
    bearish: 'border-red-500/30 bg-red-500/5',
  };

  const iconColors = {
    bullish: 'text-green-500',
    neutral: 'text-amber-500',
    bearish: 'text-red-500',
  };

  return (
    <div className={`rounded-2xl p-4 border-2 ${sentimentColors[sentiment.sentiment]}`}>
      <div className="flex items-center gap-3 mb-3">
        <TrendIcon className={`w-6 h-6 ${iconColors[sentiment.sentiment]}`} />
        <div>
          <h4 className="font-semibold text-on-surface capitalize">
            {sentiment.sentiment} Sentiment
          </h4>
          <p className="text-xs text-on-surface-variant">
            {Math.round(sentiment.confidence * 100)}% confidence
          </p>
        </div>
      </div>

      <p className="text-sm text-on-surface mb-3">{sentiment.summary}</p>

      <div className="flex flex-wrap gap-2">
        {sentiment.factors.map((factor, i) => (
          <span
            key={i}
            className="text-xs px-2 py-1 bg-surface-container-high rounded-full text-on-surface-variant"
          >
            {factor}
          </span>
        ))}
      </div>
    </div>
  );
}

export function NewsSection({ news, sentiment, fetchedAt }: NewsSectionProps) {
  if (!news.length && !sentiment) return null;

  return (
    <section className="bg-surface-container rounded-3xl p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Newspaper className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-on-surface">Market News</h2>
        </div>
        {fetchedAt && (
          <div className="flex items-center gap-1 text-xs text-on-surface-variant">
            <Clock className="w-3 h-3" />
            <span>Updated {new Date(fetchedAt).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      <p className="text-sm text-on-surface-variant mb-6">
        Real-time market news and sentiment powered by Google Search
      </p>

      {/* Market Sentiment */}
      {sentiment && (
        <div className="mb-6">
          <SentimentCard sentiment={sentiment} />
        </div>
      )}

      {/* News Grid */}
      {news.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {news.map((item, i) => (
            <NewsCard key={i} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
