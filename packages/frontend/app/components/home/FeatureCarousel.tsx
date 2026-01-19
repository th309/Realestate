'use client';

import { useState, useEffect } from 'react';

interface FeatureSlide {
  title: string;
  description: string;
  icon: React.ReactNode;
  mockup: React.ReactNode;
}

// Styled mockup components representing each feature
function MapMockup() {
  return (
    <div className="w-full h-full bg-surface-container rounded-xl overflow-hidden relative">
      {/* Header bar */}
      <div className="h-8 bg-surface-container-high flex items-center px-3 gap-2">
        <div className="w-16 h-4 bg-primary/20 rounded" />
        <div className="flex gap-1 ml-auto">
          {['State', 'Metro', 'County'].map((label) => (
            <div key={label} className="px-2 py-0.5 text-[8px] bg-surface-container rounded text-on-surface-variant">
              {label}
            </div>
          ))}
        </div>
      </div>
      {/* Map area with colored regions */}
      <div className="absolute inset-0 top-8 p-2">
        <svg viewBox="0 0 200 120" className="w-full h-full">
          {/* Simplified US map shapes */}
          <path d="M20,30 L50,25 L55,40 L45,55 L25,50 Z" className="fill-tertiary/60" />
          <path d="M55,25 L90,20 L95,45 L85,55 L55,40 Z" className="fill-secondary/60" />
          <path d="M95,20 L130,25 L125,50 L95,45 Z" className="fill-primary/60" />
          <path d="M130,25 L165,30 L160,55 L125,50 Z" className="fill-error/40" />
          <path d="M165,30 L185,35 L180,60 L160,55 Z" className="fill-tertiary/40" />
          <path d="M25,55 L45,55 L50,75 L30,80 Z" className="fill-primary/50" />
          <path d="M50,55 L85,55 L90,80 L55,85 L50,75 Z" className="fill-secondary/50" />
          <path d="M90,55 L125,50 L130,75 L95,85 L90,80 Z" className="fill-tertiary/50" />
          <path d="M125,50 L160,55 L155,80 L130,75 Z" className="fill-primary/40" />
          <path d="M30,80 L55,85 L60,100 L35,95 Z" className="fill-error/30" />
          <path d="M60,85 L95,85 L100,105 L65,100 Z" className="fill-secondary/40" />
          <path d="M100,85 L130,75 L140,100 L105,105 Z" className="fill-primary/30" />
        </svg>
        {/* Legend */}
        <div className="absolute bottom-2 left-2 bg-surface/90 rounded px-2 py-1">
          <div className="text-[8px] text-on-surface-variant mb-1">Home Value</div>
          <div className="flex gap-0.5">
            {['bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-error/60'].map((color, i) => (
              <div key={i} className={`w-3 h-2 ${color} rounded-sm`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GraphsMockup() {
  return (
    <div className="w-full h-full bg-surface-container rounded-xl overflow-hidden p-3">
      {/* Title */}
      <div className="text-[10px] font-medium text-on-surface mb-2">Market Trends</div>
      {/* Chart area */}
      <div className="h-3/4 relative">
        <svg viewBox="0 0 200 100" className="w-full h-full" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line key={y} x1="0" y1={y} x2="200" y2={y} className="stroke-outline-variant/30" strokeWidth="0.5" />
          ))}
          {/* Area fill */}
          <path
            d="M0,80 Q30,70 50,65 T100,50 T150,35 T200,25 L200,100 L0,100 Z"
            className="fill-primary/20"
          />
          {/* Line */}
          <path
            d="M0,80 Q30,70 50,65 T100,50 T150,35 T200,25"
            className="stroke-primary"
            strokeWidth="2"
            fill="none"
          />
          {/* Second line */}
          <path
            d="M0,85 Q30,80 50,78 T100,72 T150,68 T200,60"
            className="stroke-secondary"
            strokeWidth="2"
            fill="none"
            strokeDasharray="4 2"
          />
        </svg>
      </div>
      {/* Legend */}
      <div className="flex gap-3 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-primary rounded" />
          <span className="text-[8px] text-on-surface-variant">Home Value</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-secondary rounded" />
          <span className="text-[8px] text-on-surface-variant">Rent Index</span>
        </div>
      </div>
    </div>
  );
}

function ScoresMockup() {
  return (
    <div className="w-full h-full bg-surface-container rounded-xl overflow-hidden p-3">
      <div className="text-[10px] font-medium text-on-surface mb-3">Market Scores</div>
      <div className="flex justify-around items-center h-3/4">
        {[
          { score: 87, label: 'HomeReady', color: 'hsl(104, 70%, 45%)' },
          { score: 72, label: 'InvestorEdge', color: 'hsl(86, 70%, 45%)' },
          { score: 94, label: 'Market Health', color: 'hsl(113, 70%, 45%)' },
        ].map((item) => (
          <div key={item.label} className="flex flex-col items-center">
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" className="stroke-outline-variant/30" strokeWidth="3" />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke={item.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 20}
                strokeDashoffset={2 * Math.PI * 20 * (1 - item.score / 100)}
                transform="rotate(-90 24 24)"
              />
              <text x="24" y="24" textAnchor="middle" dominantBaseline="middle" className="text-xs font-semibold" fill={item.color}>
                {item.score}
              </text>
            </svg>
            <span className="text-[8px] text-on-surface-variant mt-1">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsMockup() {
  return (
    <div className="w-full h-full bg-surface-container rounded-xl overflow-hidden p-3">
      <div className="text-[10px] font-medium text-on-surface mb-2">Market Report</div>
      {/* Document preview */}
      <div className="bg-surface rounded p-2 h-3/4">
        <div className="w-full h-2 bg-on-surface/10 rounded mb-2" />
        <div className="w-3/4 h-2 bg-on-surface/10 rounded mb-3" />
        <div className="flex gap-2 mb-2">
          <div className="w-1/2 h-8 bg-primary/20 rounded" />
          <div className="w-1/2 h-8 bg-secondary/20 rounded" />
        </div>
        <div className="w-full h-1.5 bg-on-surface/10 rounded mb-1" />
        <div className="w-full h-1.5 bg-on-surface/10 rounded mb-1" />
        <div className="w-2/3 h-1.5 bg-on-surface/10 rounded" />
      </div>
    </div>
  );
}

// Icons for each slide
const SlideIcons = {
  Map: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" />
      <path d="M8 2v16M16 6v16" />
    </svg>
  ),
  Graph: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M18 9l-5 5-4-4-6 6" />
    </svg>
  ),
  Score: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  Report: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
};

const SLIDES: FeatureSlide[] = [
  {
    title: 'Interactive Market Maps',
    description: 'Explore home values and trends across all US metros',
    icon: <SlideIcons.Map />,
    mockup: <MapMockup />,
  },
  {
    title: 'Trend Analysis Graphs',
    description: 'Track price appreciation and rental growth over time',
    icon: <SlideIcons.Graph />,
    mockup: <GraphsMockup />,
  },
  {
    title: 'AI-Powered Scores',
    description: 'Instantly evaluate any market with our scoring system',
    icon: <SlideIcons.Score />,
    mockup: <ScoresMockup />,
  },
  {
    title: 'Professional Reports',
    description: 'Generate shareable market analysis for clients',
    icon: <SlideIcons.Report />,
    mockup: <ReportsMockup />,
  },
];

export function FeatureCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-advance slides
  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isHovered]);

  return (
    <div
      className="relative w-full max-w-md aspect-[4/3]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main preview window with browser chrome */}
      <div className="w-full h-full rounded-2xl overflow-hidden elevation-3 bg-surface-container-high">
        {/* Browser chrome */}
        <div className="h-7 bg-surface-container-highest flex items-center px-3 gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-error/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-tertiary/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-primary/60" />
          </div>
          <div className="flex-1 mx-2">
            <div className="h-4 bg-surface-container rounded-full flex items-center px-2">
              <span className="text-[9px] text-on-surface-variant">propertyiq.com</span>
            </div>
          </div>
        </div>

        {/* Content area with slides */}
        <div className="relative h-[calc(100%-1.75rem)] overflow-hidden">
          {SLIDES.map((slide, index) => (
            <div
              key={slide.title}
              className="absolute inset-0 p-2 transition-all duration-500"
              style={{
                opacity: index === activeIndex ? 1 : 0,
                transform: `translateX(${(index - activeIndex) * 100}%)`,
              }}
            >
              {slide.mockup}
            </div>
          ))}
        </div>
      </div>

      {/* Slide indicators and info */}
      <div className="absolute -bottom-16 left-0 right-0">
        {/* Current slide info */}
        <div className="text-center mb-3">
          <div className="inline-flex items-center gap-2 text-on-surface">
            <span className="text-primary">{SLIDES[activeIndex].icon}</span>
            <span className="text-sm font-medium">{SLIDES[activeIndex].title}</span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">{SLIDES[activeIndex].description}</p>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2">
          {SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? 'bg-primary w-6'
                  : 'bg-outline-variant hover:bg-outline'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
