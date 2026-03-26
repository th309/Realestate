"use client";

import React from "react";

type Shape = "square" | "horizontal" | "vertical";

/* ------------------------------------------------------------------ */
/*  Score Widget Mockup                                                */
/* ------------------------------------------------------------------ */

export function ScoreMockup({ shape }: { shape: Shape }) {
  const ringSize = shape === "horizontal" ? "w-20 h-20" : "w-24 h-24";

  const ring = (
    <div className="relative flex-shrink-0">
      <svg viewBox="0 0 100 100" className={ringSize}>
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="4"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="url(#scoreG)"
          strokeWidth="5"
          strokeDasharray={`${0.82 * 264} ${264}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        {/* Tick marks at 33% and 66% */}
        <line
          x1="50"
          y1="6"
          x2="50"
          y2="12"
          stroke="#94a3b8"
          strokeWidth="1.5"
          transform="rotate(119 50 50)"
        />
        <line
          x1="50"
          y1="6"
          x2="50"
          y2="12"
          stroke="#94a3b8"
          strokeWidth="1.5"
          transform="rotate(238 50 50)"
        />
        <defs>
          <linearGradient id="scoreG" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        <text
          x="50"
          y="48"
          textAnchor="middle"
          fontSize="22"
          fontWeight="700"
          fill="#1e293b"
        >
          82
        </text>
        <text
          x="50"
          y="62"
          textAnchor="middle"
          fontSize="8"
          fontWeight="600"
          fill="#16a34a"
          letterSpacing="1"
        >
          GREAT
        </text>
      </svg>
      <span className="absolute -top-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-sm">
        A
      </span>
    </div>
  );

  const breakdown = (
    <div className="flex flex-col gap-1.5 w-full">
      {[
        { label: "Affordability", pct: 78, color: "bg-emerald-500" },
        { label: "Growth", pct: 85, color: "bg-blue-500" },
        { label: "Stability", pct: 68, color: "bg-amber-500" },
        { label: "Supply/Demand", pct: 72, color: "bg-violet-500" },
      ].map(({ label, pct, color }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-[10px] text-on-surface-variant w-20 text-right truncate">
            {label}
          </span>
          <div className="flex-1 h-2 rounded-full bg-outline-variant/20 overflow-hidden">
            <div
              className={`h-full rounded-full ${color}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-on-surface w-6">
            {pct}
          </span>
        </div>
      ))}
    </div>
  );

  const location = (
    <div className="text-[11px] text-on-surface-variant">
      Dallas-Fort Worth, TX
    </div>
  );

  if (shape === "horizontal") {
    return (
      <div className="flex items-center gap-5 h-full w-full px-4 py-3">
        {ring}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-on-surface">
              HomeReady Score
            </span>
            {location}
          </div>
          {breakdown}
        </div>
      </div>
    );
  }

  if (shape === "vertical") {
    return (
      <div className="flex flex-col items-center gap-3 h-full w-full px-4 py-4">
        <span className="text-xs font-semibold text-on-surface tracking-wide">
          HomeReady Score
        </span>
        {ring}
        {location}
        <div className="w-full mt-auto">{breakdown}</div>
      </div>
    );
  }

  // Square
  return (
    <div className="flex flex-col items-center justify-center gap-2 h-full w-full p-3">
      <span className="text-xs font-semibold text-on-surface tracking-wide">
        HomeReady Score
      </span>
      {ring}
      {location}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Metric Card Mockup                                                 */
/* ------------------------------------------------------------------ */

export function MetricCardMockup({ shape }: { shape: Shape }) {
  const sparkPoints =
    "M0,18 C4,16 8,14 12,15 C16,16 20,12 24,9 C28,6 32,8 36,5 C40,2 44,4 48,3 C52,2 56,1 60,2";

  const sparkline = (
    <svg viewBox="0 0 60 20" className="w-full h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={sparkPoints + " L60,20 L0,20 Z"} fill="url(#sparkFill)" />
      <path
        d={sparkPoints}
        fill="none"
        stroke="#22c55e"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );

  const trendBadge = (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
      <svg viewBox="0 0 12 12" className="w-3 h-3">
        <path d="M6 2 L10 7 L2 7 Z" fill="currentColor" />
      </svg>
      +3.2%
    </span>
  );

  if (shape === "horizontal") {
    return (
      <div className="flex items-center h-full w-full px-5 py-3 gap-4">
        <div className="flex flex-col gap-1 flex-shrink-0">
          <span className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
            Median Home Value
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-on-surface">$450K</span>
            {trendBadge}
          </div>
          <span className="text-[10px] text-on-surface-variant">
            Dallas-Fort Worth, TX • Mar 2026
          </span>
        </div>
        <div className="flex-1 min-w-[80px]">{sparkline}</div>
      </div>
    );
  }

  if (shape === "vertical") {
    return (
      <div className="flex flex-col items-center justify-between h-full w-full px-4 py-4">
        <span className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
          Median Home Value
        </span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl font-bold text-on-surface">$450K</span>
          {trendBadge}
        </div>
        <div className="w-full">{sparkline}</div>
        <span className="text-[10px] text-on-surface-variant">
          Dallas-Fort Worth, TX • Mar 2026
        </span>
      </div>
    );
  }

  // Square
  return (
    <div className="flex flex-col items-center justify-center gap-2 h-full w-full p-4">
      <span className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
        Median Home Value
      </span>
      <span className="text-3xl font-bold text-on-surface">$450K</span>
      {trendBadge}
      <div className="w-full mt-1">{sparkline}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Map Widget Mockup — SVG map of US with colored states              */
/* ------------------------------------------------------------------ */

export function MapMockup({ shape }: { shape: Shape }) {
  // Simplified US outline with state-like regions using paths
  const mapSvg = (
    <svg
      viewBox="0 0 200 130"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Background */}
      <rect width="200" height="130" fill="#f8fafc" rx="4" />
      {/* Simplified US state-like polygons with choropleth coloring */}
      {/* West */}
      <path d="M10,15 L30,12 L35,45 L15,50 Z" fill="#7c3aed" opacity="0.7" />
      <path d="M30,12 L55,10 L55,35 L35,38 Z" fill="#8b5cf6" opacity="0.6" />
      <path d="M15,50 L35,45 L40,70 L18,72 Z" fill="#6d28d9" opacity="0.7" />
      <path d="M35,38 L55,35 L55,60 L40,62 Z" fill="#a78bfa" opacity="0.5" />
      {/* Mountain/Central */}
      <path d="M55,10 L85,8 L85,35 L55,35 Z" fill="#f59e0b" opacity="0.6" />
      <path d="M55,35 L85,35 L88,65 L55,60 Z" fill="#fb923c" opacity="0.7" />
      <path d="M40,62 L55,60 L58,85 L38,88 Z" fill="#ef4444" opacity="0.6" />
      <path d="M55,60 L88,65 L90,90 L58,85 Z" fill="#dc2626" opacity="0.7" />
      {/* Midwest */}
      <path d="M85,8 L120,10 L118,40 L85,35 Z" fill="#eab308" opacity="0.5" />
      <path d="M85,35 L118,40 L120,68 L88,65 Z" fill="#f97316" opacity="0.6" />
      <path
        d="M120,10 L150,12 L148,42 L118,40 Z"
        fill="#84cc16"
        opacity="0.5"
      />
      <path
        d="M118,40 L148,42 L150,70 L120,68 Z"
        fill="#22c55e"
        opacity="0.6"
      />
      {/* East */}
      <path
        d="M150,12 L178,15 L175,45 L148,42 Z"
        fill="#06b6d4"
        opacity="0.6"
      />
      <path
        d="M148,42 L175,45 L178,72 L150,70 Z"
        fill="#22c55e"
        opacity="0.7"
      />
      <path
        d="M178,15 L195,20 L192,50 L175,45 Z"
        fill="#14b8a6"
        opacity="0.6"
      />
      <path
        d="M175,45 L192,50 L190,75 L178,72 Z"
        fill="#10b981"
        opacity="0.7"
      />
      {/* South */}
      <path d="M88,65 L120,68 L122,95 L90,90 Z" fill="#ef4444" opacity="0.7" />
      <path
        d="M120,68 L150,70 L152,98 L122,95 Z"
        fill="#f97316"
        opacity="0.6"
      />
      <path
        d="M150,70 L178,72 L180,100 L152,98 Z"
        fill="#eab308"
        opacity="0.5"
      />
      <path
        d="M90,90 L122,95 L125,115 L92,112 Z"
        fill="#dc2626"
        opacity="0.6"
      />
      <path
        d="M122,95 L152,98 L155,118 L125,115 Z"
        fill="#f59e0b"
        opacity="0.6"
      />
      {/* City dots */}
      <circle cx="170" cy="38" r="2" fill="#1e293b" opacity="0.7" />
      <circle cx="105" cy="52" r="2" fill="#1e293b" opacity="0.7" />
      <circle cx="140" cy="88" r="2" fill="#1e293b" opacity="0.7" />
      <circle cx="60" cy="75" r="2" fill="#1e293b" opacity="0.7" />
      <circle cx="80" cy="28" r="2" fill="#1e293b" opacity="0.7" />
    </svg>
  );

  const legend = (
    <div className="flex items-center gap-1.5 justify-center">
      <span className="text-[9px] text-on-surface-variant font-medium">
        Low
      </span>
      <div className="flex rounded-sm overflow-hidden">
        {["#7c3aed", "#8b5cf6", "#eab308", "#f97316", "#ef4444", "#dc2626"].map(
          (c, i) => (
            <div key={i} className="w-4 h-2.5" style={{ backgroundColor: c }} />
          ),
        )}
      </div>
      <span className="text-[9px] text-on-surface-variant font-medium">
        High
      </span>
    </div>
  );

  const title = (
    <div className="flex items-center justify-between w-full">
      <span className="text-[11px] font-semibold text-on-surface">
        Home Value by State
      </span>
      <span className="text-[9px] text-on-surface-variant">Mar 2026</span>
    </div>
  );

  if (shape === "horizontal") {
    return (
      <div className="flex flex-col h-full w-full p-3 gap-1.5">
        {title}
        <div className="flex-1 min-h-0">{mapSvg}</div>
        {legend}
      </div>
    );
  }

  if (shape === "vertical") {
    return (
      <div className="flex flex-col h-full w-full p-3 gap-2">
        {title}
        <div className="flex-1 min-h-0">{mapSvg}</div>
        {legend}
        <div className="text-[9px] text-on-surface-variant text-center">
          Hover over a state to see details
        </div>
      </div>
    );
  }

  // Square
  return (
    <div className="flex flex-col h-full w-full p-3 gap-1.5">
      {title}
      <div className="flex-1 min-h-0">{mapSvg}</div>
      {legend}
    </div>
  );
}
