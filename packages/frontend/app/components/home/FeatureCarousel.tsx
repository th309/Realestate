'use client';

import { useState, useEffect } from 'react';

/**
 * Hero visual showcase - A dynamic dashboard preview with floating accent cards
 * Designed to fill the hero section's right side with engaging visuals
 */
export function FeatureCarousel() {
  const [activeMetric, setActiveMetric] = useState(0);
  const metrics = ['Home Value', 'Rent Index', 'Cap Rate', 'Growth'];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMetric((prev) => (prev + 1) % metrics.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [metrics.length]);

  return (
    <div className="relative w-full max-w-xl lg:max-w-2xl">
      {/* Decorative background glow */}
      <div
        className="absolute inset-0 -z-10 blur-3xl opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, var(--md-primary) 0%, transparent 70%)',
        }}
      />

      {/* Main dashboard preview */}
      <div className="relative">
        {/* Browser window frame */}
        <div className="rounded-2xl overflow-hidden elevation-4 bg-surface-container border border-outline-variant/30">
          {/* Browser chrome */}
          <div className="h-8 bg-surface-container-highest flex items-center px-4 gap-3 border-b border-outline-variant/30">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-error/70" />
              <div className="w-3 h-3 rounded-full bg-tertiary/70" />
              <div className="w-3 h-3 rounded-full bg-primary/70" />
            </div>
            <div className="flex-1 max-w-xs">
              <div className="h-5 bg-surface-container rounded-full flex items-center px-3 gap-2">
                <svg className="w-3 h-3 text-on-surface-variant/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <span className="text-xs text-on-surface-variant">propertyiq.com/maps</span>
              </div>
            </div>
          </div>

          {/* App content - Map with sidebar */}
          <div className="flex h-72 md:h-80 lg:h-96">
            {/* Sidebar */}
            <div className="w-48 md:w-56 bg-surface border-r border-outline-variant/30 p-3 flex flex-col">
              <div className="text-xs font-semibold text-on-surface mb-3">Market Trends</div>

              {/* Metric selector pills */}
              <div className="flex gap-1 mb-4">
                <div className="px-2 py-1 text-[10px] rounded-full bg-primary text-on-primary">Investor</div>
                <div className="px-2 py-1 text-[10px] rounded-full bg-surface-container text-on-surface-variant">Homebuyer</div>
              </div>

              {/* Score card */}
              <div className="bg-surface-container rounded-lg p-3 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-full border-3 border-primary flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">87</span>
                  </div>
                  <div>
                    <div className="text-[10px] font-medium text-on-surface">InvestorEdge</div>
                    <div className="text-[9px] text-on-surface-variant">Score</div>
                  </div>
                </div>
              </div>

              {/* Metric categories */}
              {['Cash Flow', 'Appreciation', 'Demand & Risk', 'Area Profile'].map((item, i) => (
                <div
                  key={item}
                  className={`flex items-center gap-2 py-2 px-2 rounded-lg mb-1 transition-colors ${
                    i === 0 ? 'bg-primary-container/50' : 'hover:bg-surface-container'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center ${
                    i === 0 ? 'bg-primary/20 text-primary' : 'bg-surface-container text-on-surface-variant'
                  }`}>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {i === 0 && <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />}
                      {i === 1 && <path d="M23 6l-9.5 9.5-5-5L1 18" />}
                      {i === 2 && <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>}
                      {i === 3 && <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>}
                    </svg>
                  </div>
                  <span className="text-[10px] text-on-surface">{item}</span>
                  <svg className="w-3 h-3 ml-auto text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              ))}
            </div>

            {/* Map area */}
            <div className="flex-1 relative bg-surface-container-low">
              {/* Simplified US map */}
              <svg viewBox="0 0 400 250" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" className="[stop-color:var(--md-primary)]" stopOpacity="0.1" />
                    <stop offset="100%" className="[stop-color:var(--md-tertiary)]" stopOpacity="0.1" />
                  </linearGradient>
                </defs>

                {/* Background */}
                <rect width="400" height="250" fill="url(#mapGradient)" />

                {/* State shapes with varying colors */}
                <g className="opacity-90">
                  {/* West */}
                  <path d="M30,40 L70,35 L75,90 L65,120 L35,115 Z" className="fill-tertiary/50 stroke-surface stroke-1" />
                  <path d="M75,35 L120,30 L130,95 L75,90 Z" className="fill-secondary/40 stroke-surface stroke-1" />
                  <path d="M35,120 L65,120 L70,160 L40,165 Z" className="fill-primary/60 stroke-surface stroke-1" />
                  <path d="M70,120 L130,95 L140,155 L70,160 Z" className="fill-error/40 stroke-surface stroke-1" />

                  {/* Central */}
                  <path d="M130,30 L200,25 L210,80 L130,95 Z" className="fill-primary/50 stroke-surface stroke-1" />
                  <path d="M200,25 L270,30 L275,85 L210,80 Z" className="fill-tertiary/60 stroke-surface stroke-1" />
                  <path d="M130,95 L210,80 L220,145 L140,155 Z" className="fill-secondary/50 stroke-surface stroke-1" />
                  <path d="M210,80 L275,85 L280,150 L220,145 Z" className="fill-primary/40 stroke-surface stroke-1" />

                  {/* East */}
                  <path d="M275,30 L340,40 L350,100 L275,85 Z" className="fill-error/50 stroke-surface stroke-1" />
                  <path d="M340,40 L380,50 L375,110 L350,100 Z" className="fill-secondary/60 stroke-surface stroke-1" />
                  <path d="M275,85 L350,100 L360,165 L280,150 Z" className="fill-tertiary/40 stroke-surface stroke-1" />
                  <path d="M350,100 L375,110 L370,170 L360,165 Z" className="fill-primary/70 stroke-surface stroke-1" />

                  {/* South */}
                  <path d="M140,155 L220,145 L230,210 L150,215 Z" className="fill-secondary/45 stroke-surface stroke-1" />
                  <path d="M220,145 L280,150 L290,205 L230,210 Z" className="fill-error/35 stroke-surface stroke-1" />
                  <path d="M280,150 L360,165 L355,200 L290,205 Z" className="fill-primary/55 stroke-surface stroke-1" />
                </g>

                {/* State labels with values */}
                <g className="text-[8px] font-medium fill-on-surface">
                  <text x="52" y="80"><tspan className="font-semibold">CA</tspan></text>
                  <text x="48" y="92" className="text-[7px] fill-on-surface-variant">$699K</text>

                  <text x="160" y="60"><tspan className="font-semibold">CO</tspan></text>
                  <text x="156" y="72" className="text-[7px] fill-on-surface-variant">$549K</text>

                  <text x="240" y="60"><tspan className="font-semibold">IL</tspan></text>
                  <text x="232" y="72" className="text-[7px] fill-on-surface-variant">$287K</text>

                  <text x="315" y="75"><tspan className="font-semibold">NY</tspan></text>
                  <text x="311" y="87" className="text-[7px] fill-on-surface-variant">$649K</text>

                  <text x="355" y="140"><tspan className="font-semibold">FL</tspan></text>
                  <text x="351" y="152" className="text-[7px] fill-on-surface-variant">$425K</text>

                  <text x="180" y="185"><tspan className="font-semibold">TX</tspan></text>
                  <text x="173" y="197" className="text-[7px] fill-on-surface-variant">$350K</text>
                </g>
              </svg>

              {/* Legend overlay */}
              <div className="absolute bottom-3 left-3 bg-surface/95 rounded-lg px-3 py-2 elevation-1">
                <div className="text-[9px] font-medium text-on-surface mb-1.5">{metrics[activeMetric]}</div>
                <div className="flex items-center gap-1">
                  {['bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-error/70'].map((color, i) => (
                    <div key={i} className={`w-5 h-2.5 ${color} rounded-sm`} />
                  ))}
                </div>
                <div className="flex justify-between text-[7px] text-on-surface-variant mt-0.5">
                  <span>$245K</span>
                  <span>$700K+</span>
                </div>
              </div>

              {/* Geo level selector */}
              <div className="absolute top-3 right-3 flex gap-1 bg-surface/95 rounded-lg p-1 elevation-1">
                {['State', 'Metro', 'County', 'Zip'].map((level, i) => (
                  <div
                    key={level}
                    className={`px-2 py-1 text-[9px] rounded transition-colors ${
                      i === 0 ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {level}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Floating accent cards */}
        {/* Top-right: Quick stat */}
        <div className="absolute -top-4 -right-4 md:-right-8 bg-surface rounded-xl p-3 elevation-3 border border-outline-variant/20 animate-float">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 6l-9.5 9.5-5-5L1 18" />
                <path d="M17 6h6v6" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-bold text-primary">+12.4%</div>
              <div className="text-[10px] text-on-surface-variant">YoY Growth</div>
            </div>
          </div>
        </div>

        {/* Bottom-left: Score preview */}
        <div className="absolute -bottom-6 -left-4 md:-left-8 bg-surface rounded-xl p-3 elevation-3 border border-outline-variant/20 animate-float-delayed">
          <div className="flex items-center gap-3">
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="22" fill="none" className="stroke-outline-variant/30" strokeWidth="4" />
              <circle
                cx="26"
                cy="26"
                r="22"
                fill="none"
                stroke="hsl(104, 70%, 45%)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 22}
                strokeDashoffset={2 * Math.PI * 22 * 0.13}
                transform="rotate(-90 26 26)"
              />
              <text x="26" y="26" textAnchor="middle" dominantBaseline="middle" className="text-sm font-bold" fill="hsl(104, 70%, 40%)">
                87
              </text>
            </svg>
            <div>
              <div className="text-xs font-semibold text-on-surface">HomeReady</div>
              <div className="text-[10px] text-on-surface-variant">Great for families</div>
            </div>
          </div>
        </div>

        {/* Right side: Mini chart */}
        <div className="absolute top-1/3 -right-3 md:-right-6 bg-surface rounded-xl p-2.5 elevation-3 border border-outline-variant/20 animate-float-slow hidden md:block">
          <div className="text-[9px] font-medium text-on-surface-variant mb-1">Rent Trend</div>
          <svg viewBox="0 0 80 35" className="w-20 h-9">
            <path
              d="M0,30 Q15,28 25,22 T50,15 T80,5"
              fill="none"
              className="stroke-secondary"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="80" cy="5" r="3" className="fill-secondary" />
          </svg>
        </div>
      </div>

      {/* Add floating animation styles */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 4.5s ease-in-out infinite;
          animation-delay: 0.5s;
        }
        .animate-float-slow {
          animation: float-slow 5s ease-in-out infinite;
          animation-delay: 1s;
        }
      `}</style>
    </div>
  );
}
