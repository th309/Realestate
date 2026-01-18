'use client';

import React from 'react';
import { ReportInstance, UserType } from '../types';
import { MapPin, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SCORE_INFO } from '../constants';

interface ReportCoverProps {
  report: ReportInstance;
}

function ScoreGauge({ score, type }: { score: number; type: 'HomeReady' | 'InvestorEdge' }) {
  const info = SCORE_INFO[type];
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const rotation = -90; // Start from top

  // Color based on score
  const getScoreColor = (s: number) => {
    if (s >= 75) return 'text-green-500';
    if (s >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return 'Excellent';
    if (s >= 70) return 'Good';
    if (s >= 60) return 'Fair';
    if (s >= 50) return 'Moderate';
    return 'Challenging';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-44 h-44">
        <svg className="w-full h-full transform" style={{ transform: `rotate(${rotation}deg)` }}>
          {/* Background circle */}
          <circle
            cx="88"
            cy="88"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-surface-container-highest opacity-30"
          />
          {/* Progress circle */}
          <circle
            cx="88"
            cy="88"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className={getScoreColor(score)}
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold ${getScoreColor(score)}`}>{score}</span>
          <span className="text-sm text-on-surface-variant">{getScoreLabel(score)}</span>
        </div>
      </div>
      <div className="mt-3 text-center">
        <span className={`text-lg font-semibold ${info.color}`}>{type} Score</span>
        <p className="text-xs text-on-surface-variant mt-1 max-w-48">{info.description}</p>
      </div>
    </div>
  );
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
        <ScoreGauge score={heroScore || 0} type={heroScoreType} />

        {/* Secondary Score (smaller) */}
        <div className="flex flex-col items-center opacity-60">
          <div className="relative w-24 h-24">
            <svg
              className="w-full h-full"
              style={{ transform: 'rotate(-90deg)' }}
            >
              <circle
                cx="48"
                cy="48"
                r="38"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-surface-container-highest opacity-30"
              />
              <circle
                cx="48"
                cy="48"
                r="38"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 38}
                strokeDashoffset={2 * Math.PI * 38 * (1 - (secondaryScore || 0) / 100)}
                className="text-on-surface-variant"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-semibold text-on-surface-variant">
                {secondaryScore}
              </span>
            </div>
          </div>
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
