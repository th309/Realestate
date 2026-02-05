'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';

// Sample state data for the preview
const STATE_DATA: Record<string, { name: string; price: string; change: number; x: number; y: number }> = {
  CA: { name: 'California', price: '$699K', change: 3.2, x: 52, y: 85 },
  TX: { name: 'Texas', price: '$350K', change: 5.1, x: 180, y: 175 },
  FL: { name: 'Florida', price: '$425K', change: 4.8, x: 320, y: 165 },
  NY: { name: 'New York', price: '$649K', change: 1.9, x: 340, y: 65 },
  CO: { name: 'Colorado', price: '$549K', change: 2.7, x: 145, y: 95 },
  AZ: { name: 'Arizona', price: '$425K', change: 6.2, x: 95, y: 125 },
  WA: { name: 'Washington', price: '$589K', change: 2.1, x: 70, y: 35 },
  GA: { name: 'Georgia', price: '$365K', change: 5.8, x: 300, y: 145 },
};

export function MapPreview() {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string>('TX');

  const selectedData = STATE_DATA[selectedState];

  return (
    <div className="relative w-full h-full min-h-[320px] bg-surface-container rounded-xl overflow-hidden">
      {/* Mini map header */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface/95 rounded-lg shadow-sm">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-on-surface">Median Home Prices</span>
        </div>
        <div className="flex gap-1 bg-surface/95 rounded-lg p-1 shadow-sm">
          {['State', 'Metro'].map((level, i) => (
            <span
              key={level}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                i === 0 ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
              }`}
            >
              {level}
            </span>
          ))}
        </div>
      </div>

      {/* Interactive SVG Map */}
      <svg viewBox="0 0 400 220" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="demoMapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="[stop-color:var(--md-primary)]" stopOpacity="0.05" />
            <stop offset="100%" className="[stop-color:var(--md-tertiary)]" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Background */}
        <rect width="400" height="220" fill="url(#demoMapGradient)" />

        {/* Simplified US map shapes */}
        <g className="opacity-90">
          {/* West Coast */}
          <path
            d="M30,30 L70,25 L80,100 L70,130 L35,125 Z"
            className={`transition-all cursor-pointer ${
              selectedState === 'CA' ? 'fill-primary stroke-primary' :
              hoveredState === 'CA' ? 'fill-primary/40 stroke-primary' : 'fill-tertiary/40 stroke-surface'
            }`}
            strokeWidth="1"
            onMouseEnter={() => setHoveredState('CA')}
            onMouseLeave={() => setHoveredState(null)}
            onClick={() => setSelectedState('CA')}
          />
          <path
            d="M35,15 L70,10 L70,25 L30,30 Z"
            className={`transition-all cursor-pointer ${
              selectedState === 'WA' ? 'fill-primary stroke-primary' :
              hoveredState === 'WA' ? 'fill-primary/40 stroke-primary' : 'fill-secondary/40 stroke-surface'
            }`}
            strokeWidth="1"
            onMouseEnter={() => setHoveredState('WA')}
            onMouseLeave={() => setHoveredState(null)}
            onClick={() => setSelectedState('WA')}
          />

          {/* Southwest */}
          <path
            d="M70,100 L130,85 L140,140 L70,145 Z"
            className={`transition-all cursor-pointer ${
              selectedState === 'AZ' ? 'fill-primary stroke-primary' :
              hoveredState === 'AZ' ? 'fill-primary/40 stroke-primary' : 'fill-error/40 stroke-surface'
            }`}
            strokeWidth="1"
            onMouseEnter={() => setHoveredState('AZ')}
            onMouseLeave={() => setHoveredState(null)}
            onClick={() => setSelectedState('AZ')}
          />

          {/* Mountain */}
          <path
            d="M80,25 L160,20 L170,85 L130,85 L80,100 Z"
            className={`transition-all cursor-pointer ${
              selectedState === 'CO' ? 'fill-primary stroke-primary' :
              hoveredState === 'CO' ? 'fill-primary/40 stroke-primary' : 'fill-primary/40 stroke-surface'
            }`}
            strokeWidth="1"
            onMouseEnter={() => setHoveredState('CO')}
            onMouseLeave={() => setHoveredState(null)}
            onClick={() => setSelectedState('CO')}
          />

          {/* Texas */}
          <path
            d="M140,140 L230,130 L240,200 L160,205 L140,160 Z"
            className={`transition-all cursor-pointer ${
              selectedState === 'TX' ? 'fill-primary stroke-primary' :
              hoveredState === 'TX' ? 'fill-primary/40 stroke-primary' : 'fill-secondary/50 stroke-surface'
            }`}
            strokeWidth="1"
            onMouseEnter={() => setHoveredState('TX')}
            onMouseLeave={() => setHoveredState(null)}
            onClick={() => setSelectedState('TX')}
          />

          {/* Central states */}
          <path
            d="M160,20 L260,25 L265,100 L170,85 Z"
            className="fill-tertiary/30 stroke-surface"
            strokeWidth="1"
          />
          <path
            d="M170,85 L265,100 L270,130 L230,130 L140,140 L130,85 Z"
            className="fill-secondary/30 stroke-surface"
            strokeWidth="1"
          />

          {/* Southeast */}
          <path
            d="M270,100 L330,95 L340,160 L270,150 Z"
            className={`transition-all cursor-pointer ${
              selectedState === 'GA' ? 'fill-primary stroke-primary' :
              hoveredState === 'GA' ? 'fill-primary/40 stroke-primary' : 'fill-primary/50 stroke-surface'
            }`}
            strokeWidth="1"
            onMouseEnter={() => setHoveredState('GA')}
            onMouseLeave={() => setHoveredState(null)}
            onClick={() => setSelectedState('GA')}
          />

          {/* Florida */}
          <path
            d="M300,160 L340,160 L350,200 L320,210 L295,180 Z"
            className={`transition-all cursor-pointer ${
              selectedState === 'FL' ? 'fill-primary stroke-primary' :
              hoveredState === 'FL' ? 'fill-primary/40 stroke-primary' : 'fill-tertiary/50 stroke-surface'
            }`}
            strokeWidth="1"
            onMouseEnter={() => setHoveredState('FL')}
            onMouseLeave={() => setHoveredState(null)}
            onClick={() => setSelectedState('FL')}
          />

          {/* Northeast */}
          <path
            d="M260,25 L340,35 L350,70 L330,95 L265,100 Z"
            className="fill-error/30 stroke-surface"
            strokeWidth="1"
          />
          <path
            d="M340,35 L380,45 L375,80 L350,70 Z"
            className={`transition-all cursor-pointer ${
              selectedState === 'NY' ? 'fill-primary stroke-primary' :
              hoveredState === 'NY' ? 'fill-primary/40 stroke-primary' : 'fill-secondary/50 stroke-surface'
            }`}
            strokeWidth="1"
            onMouseEnter={() => setHoveredState('NY')}
            onMouseLeave={() => setHoveredState(null)}
            onClick={() => setSelectedState('NY')}
          />
        </g>

        {/* State labels */}
        <g className="pointer-events-none">
          {Object.entries(STATE_DATA).map(([code, data]) => (
            <g key={code}>
              <text
                x={data.x}
                y={data.y}
                className={`text-[9px] font-semibold ${
                  selectedState === code ? 'fill-on-primary' : 'fill-on-surface'
                }`}
                textAnchor="middle"
              >
                {code}
              </text>
              <text
                x={data.x}
                y={data.y + 11}
                className={`text-[7px] ${
                  selectedState === code ? 'fill-on-primary/80' : 'fill-on-surface-variant'
                }`}
                textAnchor="middle"
              >
                {data.price}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Selected state info card */}
      <div className="absolute bottom-3 left-3 right-3 bg-surface/95 rounded-lg p-3 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-on-surface-variant">Selected</div>
            <div className="text-lg font-semibold text-on-surface">{selectedData.name}</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-primary">{selectedData.price}</div>
            <div className={`text-xs font-medium ${selectedData.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {selectedData.change > 0 ? '+' : ''}{selectedData.change}% YoY
            </div>
          </div>
        </div>
        <Link
          href="/map"
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Explore Full Map
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Hover tooltip */}
      {hoveredState && hoveredState !== selectedState && (
        <div
          className="absolute bg-surface shadow-lg rounded-lg px-3 py-2 pointer-events-none z-20"
          style={{
            left: STATE_DATA[hoveredState].x + 20,
            top: STATE_DATA[hoveredState].y - 10,
          }}
        >
          <div className="text-xs font-medium text-on-surface">{STATE_DATA[hoveredState].name}</div>
          <div className="text-sm font-bold text-primary">{STATE_DATA[hoveredState].price}</div>
        </div>
      )}
    </div>
  );
}
