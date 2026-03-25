"use client";

import React from "react";

type Shape = "square" | "horizontal" | "vertical";

/* ------------------------------------------------------------------ */
/*  Score Widget Mockup                                               */
/* ------------------------------------------------------------------ */

export function ScoreMockup({ shape }: { shape: Shape }) {
  const ring = (
    <div className="relative flex items-center justify-center">
      {/* Outer ring */}
      <svg viewBox="0 0 80 80" className="w-16 h-16">
        <circle
          cx="40"
          cy="40"
          r="34"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-outline-variant/30"
        />
        <circle
          cx="40"
          cy="40"
          r="34"
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth="4"
          strokeDasharray="171"
          strokeDashoffset="30"
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>
        <text
          x="40"
          y="43"
          textAnchor="middle"
          className="fill-on-surface text-[18px] font-bold"
        >
          82
        </text>
      </svg>
      {/* Confidence badge */}
      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
        A
      </span>
    </div>
  );

  const details = (
    <div className="flex flex-col gap-0.5 text-center">
      <span className="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase">
        HomeReady Score
      </span>
      <span className="text-[10px] font-medium text-emerald-600 uppercase">
        Great
      </span>
    </div>
  );

  if (shape === "horizontal") {
    return (
      <div className="flex items-center gap-4 h-full w-full justify-center">
        {ring}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-on-surface">
            HomeReady Score
          </span>
          <span className="text-[10px] font-medium text-emerald-600 uppercase">
            Great
          </span>
          <span className="text-[10px] text-on-surface-variant mt-1">
            Dallas-Fort Worth, TX
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 h-full w-full">
      {ring}
      {details}
      {shape === "vertical" && (
        <div className="mt-1 flex flex-col gap-1 w-full px-3">
          {[
            { label: "Affordability", pct: 78 },
            { label: "Growth", pct: 85 },
            { label: "Stability", pct: 68 },
          ].map(({ label, pct }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[9px] text-on-surface-variant w-16 text-right">
                {label}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-outline-variant/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Metric Card Mockup                                                */
/* ------------------------------------------------------------------ */

export function MetricCardMockup({ shape }: { shape: Shape }) {
  const sparklinePath =
    "M0,20 L8,18 L16,15 L24,16 L32,12 L40,8 L48,10 L56,5 L64,3";

  const valueBlock = (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase">
        Home Value
      </span>
      <span className="text-xl font-bold text-on-surface">$450K</span>
      <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600">
        <svg viewBox="0 0 12 12" className="w-3 h-3">
          <path d="M6 2 L10 7 L2 7 Z" fill="currentColor" />
        </svg>
        +3.2%
      </span>
    </div>
  );

  const sparkline = (
    <svg viewBox="0 0 64 24" className="w-20 h-8" preserveAspectRatio="none">
      <path
        d={sparklinePath}
        fill="none"
        stroke="#22c55e"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );

  if (shape === "horizontal") {
    return (
      <div className="flex items-center justify-between h-full w-full px-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase">
            Home Value
          </span>
          <span className="text-lg font-bold text-on-surface">$450K</span>
          <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600">
            <svg viewBox="0 0 12 12" className="w-3 h-3">
              <path d="M6 2 L10 7 L2 7 Z" fill="currentColor" />
            </svg>
            +3.2% YoY
          </span>
        </div>
        {sparkline}
      </div>
    );
  }

  if (shape === "vertical") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-full w-full">
        <span className="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase">
          Home Value
        </span>
        <span className="text-2xl font-bold text-on-surface">$450K</span>
        <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600">
          <svg viewBox="0 0 12 12" className="w-3 h-3">
            <path d="M6 2 L10 7 L2 7 Z" fill="currentColor" />
          </svg>
          +3.2% YoY
        </span>
        <div className="mt-1">{sparkline}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-1 h-full w-full">
      {valueBlock}
      <div className="mt-1">{sparkline}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Map Widget Mockup                                                 */
/* ------------------------------------------------------------------ */

export function MapMockup({ shape }: { shape: Shape }) {
  // Simplified choropleth representation
  const mapContent = (
    <div className="relative w-full h-full overflow-hidden rounded-lg bg-gradient-to-br from-blue-50 to-slate-100">
      {/* Grid of colored region blocks */}
      <div className="absolute inset-1 grid grid-cols-5 grid-rows-4 gap-0.5">
        {[
          "bg-violet-300",
          "bg-violet-400",
          "bg-orange-300",
          "bg-red-300",
          "bg-orange-400",
          "bg-violet-200",
          "bg-orange-200",
          "bg-orange-300",
          "bg-red-400",
          "bg-red-300",
          "bg-orange-100",
          "bg-violet-300",
          "bg-orange-200",
          "bg-orange-300",
          "bg-violet-200",
          "bg-violet-100",
          "bg-orange-100",
          "bg-violet-200",
          "bg-violet-300",
          "bg-orange-200",
        ].map((color, i) => (
          <div key={i} className={`${color} rounded-[2px] opacity-70`} />
        ))}
      </div>
      {/* Dot markers */}
      <div className="absolute top-[30%] left-[40%] w-1.5 h-1.5 rounded-full bg-on-surface/60" />
      <div className="absolute top-[55%] left-[60%] w-1.5 h-1.5 rounded-full bg-on-surface/60" />
      <div className="absolute top-[40%] left-[25%] w-1.5 h-1.5 rounded-full bg-on-surface/60" />
    </div>
  );

  const legend = (
    <div className="flex items-center gap-1 justify-center mt-1">
      <span className="text-[8px] text-on-surface-variant">Low</span>
      {[
        "bg-violet-300",
        "bg-violet-400",
        "bg-orange-300",
        "bg-orange-400",
        "bg-red-300",
        "bg-red-400",
      ].map((c, i) => (
        <div key={i} className={`w-3 h-2 rounded-[1px] ${c}`} />
      ))}
      <span className="text-[8px] text-on-surface-variant">High</span>
    </div>
  );

  if (shape === "vertical") {
    return (
      <div className="flex flex-col h-full w-full p-2 gap-1">
        <div className="flex-1">{mapContent}</div>
        {legend}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full p-2 gap-1">
      <div className="flex-1">{mapContent}</div>
      {legend}
    </div>
  );
}
