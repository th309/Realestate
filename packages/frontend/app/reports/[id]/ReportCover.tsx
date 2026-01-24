'use client';

import React from 'react';
import { ReportInstance, UserType } from '../types';
import { MapPin, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SCORE_INFO } from '../constants';
import { ScoreDisplay } from '@/app/components/scoring/ScoreDisplay';

interface ReportCoverProps {
  report: ReportInstance;
}

export function ReportCover({ report }: ReportCoverProps) {
  const userType = report.user_type as UserType;
  const heroScore =
    userType === 'investor' ? report.investoredge_score : report.homeready_score;
  const heroScoreType = userType === 'investor' ? 'InvestorEdge' : 'HomeReady';
  const secondaryScore =
    userType === 'investor' ? report.homeready_score : report.investoredge_score;
  const secondaryScoreType = userType === 'investor' ? 'HomeReady' : 'InvestorEdge';

  // Get sentiment trend icon
  const sentiment = report.populated_data?.realtime?.sentiment;
  const TrendIcon =
    sentiment?.sentiment === 'bullish'
      ? TrendingUp
      : sentiment?.sentiment === 'bearish'
        ? TrendingDown
        : Minus;

  return (
    <div className="bg-surface-container rounded-3xl p-6 md:p-8">
      {/* Title and metadata */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-on-surface mb-2">
          {report.primary_geography_name}
        </h1>
        <p className="text-on-surface-variant">{report.title}</p>
        <div className="flex items-center justify-center gap-4 mt-3 text-sm text-on-surface-variant">
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {report.primary_geography_type.charAt(0).toUpperCase() +
              report.primary_geography_type.slice(1)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {new Date(report.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Score Display */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
        {/* Hero Score */}
        <div className="flex flex-col items-center">
          <ScoreDisplay value={heroScore || 0} size={176} strokeWidth={12} />
          <div className="mt-3 text-center">
            <span className={`text-lg font-semibold ${SCORE_INFO[heroScoreType].color}`}>
              {heroScoreType} Score
            </span>
            <p className="text-xs text-on-surface-variant mt-1 max-w-48">
              {SCORE_INFO[heroScoreType].description}
            </p>
          </div>
        </div>

        {/* Secondary Score (smaller) */}
        <div className="flex flex-col items-center opacity-60">
          <ScoreDisplay value={secondaryScore || 0} size={96} strokeWidth={6} showGrade={false} />
          <span className="text-sm text-on-surface-variant mt-2">{secondaryScoreType}</span>
        </div>
      </div>

      {/* Market Sentiment Badge */}
      {sentiment && (
        <div className="flex justify-center mt-6">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm ${
              sentiment.sentiment === 'bullish'
                ? 'bg-green-500/10 text-green-600'
                : sentiment.sentiment === 'bearish'
                  ? 'bg-red-500/10 text-red-600'
                  : 'bg-amber-500/10 text-amber-600'
            }`}
          >
            <TrendIcon className="w-4 h-4" />
            <span className="font-medium capitalize">{sentiment.sentiment} Market</span>
            <span className="opacity-60">({Math.round(sentiment.confidence * 100)}% confidence)</span>
          </div>
        </div>
      )}
    </div>
  );
}
