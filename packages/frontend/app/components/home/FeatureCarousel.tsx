'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Map, BarChart3, FileText, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';

// Sample data for mini chart
const MINI_CHART_DATA = [
  { v: 30 }, { v: 35 }, { v: 32 }, { v: 40 }, { v: 38 },
  { v: 45 }, { v: 50 }, { v: 48 }, { v: 55 }, { v: 52 },
  { v: 58 }, { v: 62 },
];

const FEATURES = [
  {
    id: 'map',
    title: 'Interactive Market Maps',
    description: 'Explore 384 metros with color-coded market data',
    icon: Map,
    href: '/map',
    preview: 'map',
  },
  {
    id: 'analytics',
    title: 'Market Analytics',
    description: 'Track price trends and market indicators',
    icon: BarChart3,
    href: '/graphs',
    preview: 'chart',
  },
  {
    id: 'reports',
    title: 'Custom Reports',
    description: 'Build professional reports with drag-and-drop',
    icon: FileText,
    href: '/reports',
    preview: 'report',
  },
];

function MiniMapPreview() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <defs>
        <linearGradient id="heroMapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" className="[stop-color:var(--md-primary)]" stopOpacity="0.1" />
          <stop offset="100%" className="[stop-color:var(--md-tertiary)]" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect width="200" height="120" fill="url(#heroMapGrad)" rx="4" />
      {/* Simplified state shapes */}
      <g className="opacity-80">
        <path d="M15,20 L35,18 L40,50 L35,65 L18,62 Z" className="fill-tertiary/50" />
        <path d="M40,18 L70,15 L75,45 L40,50 Z" className="fill-primary/40" />
        <path d="M70,15 L100,18 L105,50 L75,45 Z" className="fill-secondary/50" />
        <path d="M100,18 L130,22 L135,55 L105,50 Z" className="fill-tertiary/40" />
        <path d="M130,22 L160,28 L155,60 L135,55 Z" className="fill-error/40" />
        <path d="M160,28 L185,35 L180,65 L155,60 Z" className="fill-primary/60" />
        <path d="M35,65 L75,55 L80,90 L40,95 Z" className="fill-secondary/40" />
        <path d="M75,55 L120,50 L130,85 L80,90 Z" className="fill-primary/50" />
        <path d="M120,50 L155,60 L145,95 L130,85 Z" className="fill-tertiary/50" />
      </g>
      {/* Data point indicators */}
      <circle cx="55" cy="40" r="4" className="fill-primary animate-pulse" />
      <circle cx="140" cy="45" r="4" className="fill-tertiary animate-pulse" style={{ animationDelay: '0.5s' }} />
      <circle cx="100" cy="70" r="4" className="fill-secondary animate-pulse" style={{ animationDelay: '1s' }} />
    </svg>
  );
}

function MiniChartPreview() {
  return (
    <div className="w-full h-full p-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={MINI_CHART_DATA}>
          <defs>
            <linearGradient id="heroChartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--md-primary))" stopOpacity={0.4} />
              <stop offset="95%" stopColor="hsl(var(--md-primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke="hsl(var(--md-primary))"
            strokeWidth={2}
            fill="url(#heroChartGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MiniReportPreview() {
  return (
    <div className="w-full h-full p-3 flex flex-col gap-2">
      {/* Mini section cards */}
      {[
        { label: 'Score Gauge', w: '70%' },
        { label: 'Market Metrics', w: '85%' },
        { label: 'Price Trends', w: '60%' },
      ].map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-2 p-2 bg-surface-container rounded-lg"
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          <div className="w-4 h-4 rounded bg-primary/20" />
          <div className="h-2 rounded bg-on-surface/10" style={{ width: item.w }} />
        </div>
      ))}
    </div>
  );
}

export function FeatureCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % FEATURES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const activeFeature = FEATURES[activeIndex];

  const goTo = (index: number) => {
    setActiveIndex(index);
  };

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % FEATURES.length);
  };

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + FEATURES.length) % FEATURES.length);
  };

  return (
    <div className="relative w-full max-w-xl">
      {/* Main card */}
      <div className="bg-surface rounded-2xl shadow-xl border border-outline-variant/30 overflow-hidden">
        {/* Preview area */}
        <div className="h-40 bg-surface-container-low relative">
          {activeFeature.preview === 'map' && <MiniMapPreview />}
          {activeFeature.preview === 'chart' && <MiniChartPreview />}
          {activeFeature.preview === 'report' && <MiniReportPreview />}

          {/* Navigation arrows */}
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-surface/80 hover:bg-surface shadow-md transition-colors"
            aria-label="Previous feature"
          >
            <ChevronLeft className="w-4 h-4 text-on-surface" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-surface/80 hover:bg-surface shadow-md transition-colors"
            aria-label="Next feature"
          >
            <ChevronRight className="w-4 h-4 text-on-surface" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary-container">
              <activeFeature.icon className="w-5 h-5 text-on-primary-container" />
            </div>
            <h3 className="text-lg font-semibold text-on-surface">{activeFeature.title}</h3>
          </div>
          <p className="text-sm text-on-surface-variant mb-4">{activeFeature.description}</p>
          <Link
            href={activeFeature.href}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Try it now
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Dots navigation */}
        <div className="flex justify-center gap-2 pb-4">
          {FEATURES.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === activeIndex
                  ? 'bg-primary w-6'
                  : 'bg-on-surface/20 hover:bg-on-surface/40'
              }`}
              aria-label={`Go to feature ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Floating accent cards */}
      <div className="absolute -top-3 -right-3 bg-surface rounded-xl p-2.5 shadow-lg border border-outline-variant/20 animate-bounce-slow">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">87</span>
          </div>
          <div>
            <div className="text-[10px] font-medium text-on-surface">HomeReady</div>
            <div className="text-[9px] text-on-surface-variant">Score</div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-2 -left-3 bg-surface rounded-xl p-2.5 shadow-lg border border-outline-variant/20 animate-bounce-slow" style={{ animationDelay: '0.5s' }}>
        <div className="flex items-center gap-2">
          <svg className="w-8 h-8 text-green-500" viewBox="0 0 32 32">
            <path d="M4,20 L12,14 L18,18 L28,8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div>
            <div className="text-sm font-bold text-green-600">+12.4%</div>
            <div className="text-[9px] text-on-surface-variant">YoY Growth</div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
