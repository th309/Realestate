'use client';

import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Target, Zap } from 'lucide-react';
import { Badge } from '../ui/Badge';

type InsightType = 'opportunity' | 'alert' | 'trend-up' | 'trend-down' | 'insight' | 'highlight';

interface InsightCardProps {
  type: InsightType;
  title: string;
  description: string;
  metric?: {
    label: string;
    value: string | number;
    change?: number;
  };
  action?: {
    label: string;
    onClick: () => void;
  };
  priority?: 'low' | 'medium' | 'high';
  timestamp?: string;
  className?: string;
}

const typeConfig: Record<
  InsightType,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  opportunity: {
    icon: Lightbulb,
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
    label: 'Opportunity',
  },
  alert: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    label: 'Alert',
  },
  'trend-up': {
    icon: TrendingUp,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
    label: 'Trending Up',
  },
  'trend-down': {
    icon: TrendingDown,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    label: 'Trending Down',
  },
  insight: {
    icon: Zap,
    color: 'text-primary',
    bg: 'bg-primary-container/30 border-primary-container',
    label: 'Insight',
  },
  highlight: {
    icon: Target,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    label: 'Highlight',
  },
};

const priorityStyles = {
  low: 'border-l-2 border-l-gray-300',
  medium: 'border-l-2 border-l-amber-400',
  high: 'border-l-4 border-l-red-500',
};

export const InsightCard: React.FC<InsightCardProps> = ({
  type,
  title,
  description,
  metric,
  action,
  priority,
  timestamp,
  className = '',
}) => {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={`
        ${config.bg} border rounded-xl p-4
        ${priority ? priorityStyles[priority] : ''}
        transition-all duration-200 hover:elevation-1
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div
          className={`
            p-2 rounded-lg bg-white/50
            ${config.color}
          `}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="soft" color={type === 'alert' || type === 'trend-down' ? 'error' : type === 'opportunity' ? 'warning' : 'primary'} size="sm">
              {config.label}
            </Badge>
            {timestamp && (
              <span className="text-[10px] text-on-surface-variant">
                {timestamp}
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-on-surface">{title}</h4>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-on-surface-variant mb-3">{description}</p>

      {/* Metric highlight */}
      {metric && (
        <div className="bg-white/50 rounded-lg p-3 mb-3">
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1">
            {metric.label}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-on-surface">
              {metric.value}
            </span>
            {metric.change !== undefined && (
              <span
                className={`
                  text-xs font-medium px-1.5 py-0.5 rounded
                  ${metric.change >= 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                  }
                `}
              >
                {metric.change >= 0 ? '+' : ''}
                {metric.change.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action */}
      {action && (
        <button
          onClick={action.onClick}
          className={`
            text-xs font-medium ${config.color}
            hover:underline transition-colors
          `}
        >
          {action.label} →
        </button>
      )}
    </div>
  );
};

// Compact insight for lists
interface CompactInsightProps {
  type: InsightType;
  title: string;
  value?: string | number;
  onClick?: () => void;
  className?: string;
}

export const CompactInsight: React.FC<CompactInsightProps> = ({
  type,
  title,
  value,
  onClick,
  className = '',
}) => {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 p-3 rounded-lg
        ${config.bg}
        hover:brightness-95 transition-all duration-200
        text-left
        ${className}
      `}
    >
      <Icon className={`w-4 h-4 ${config.color} shrink-0`} />
      <span className="flex-1 text-sm text-on-surface truncate">{title}</span>
      {value && (
        <span className="text-sm font-medium text-on-surface shrink-0">
          {value}
        </span>
      )}
    </button>
  );
};

// Insight carousel for multiple insights
interface InsightCarouselProps {
  insights: Array<{
    type: InsightType;
    title: string;
    description: string;
    metric?: {
      label: string;
      value: string | number;
      change?: number;
    };
  }>;
  autoPlay?: boolean;
  interval?: number;
  className?: string;
}

export const InsightCarousel: React.FC<InsightCarouselProps> = ({
  insights,
  autoPlay = true,
  interval = 5000,
  className = '',
}) => {
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    if (!autoPlay || insights.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % insights.length);
    }, interval);

    return () => clearInterval(timer);
  }, [autoPlay, interval, insights.length]);

  if (insights.length === 0) return null;

  const current = insights[activeIndex];

  return (
    <div className={className}>
      <InsightCard
        type={current.type}
        title={current.title}
        description={current.description}
        metric={current.metric}
      />

      {/* Dots indicator */}
      {insights.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {insights.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`
                w-2 h-2 rounded-full transition-all duration-200
                ${idx === activeIndex
                  ? 'bg-primary w-4'
                  : 'bg-outline-variant hover:bg-outline'
                }
              `}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// AI-generated insight badge
export const AIInsightBadge: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5
        bg-gradient-to-r from-primary-container to-secondary-container
        text-on-primary-container text-[10px] font-medium
        rounded-full
        ${className}
      `}
    >
      <Zap className="w-3 h-3" />
      AI Insight
    </span>
  );
};
