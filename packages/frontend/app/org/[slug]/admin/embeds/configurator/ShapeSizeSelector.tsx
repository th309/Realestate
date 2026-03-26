"use client";

import React from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type Shape = "square" | "horizontal" | "vertical";
export type Size = "small" | "medium" | "large";

export interface ShapeSizeSelectorProps {
  shape: Shape;
  size: Size;
  onShapeChange: (s: Shape) => void;
  onSizeChange: (s: Size) => void;
}

/* ------------------------------------------------------------------ */
/*  Dimension mapping                                                  */
/* ------------------------------------------------------------------ */

const DIMENSION_MAP: Record<Shape, Record<Size, { w: number; h: number }>> = {
  square: {
    small: { w: 200, h: 200 },
    medium: { w: 300, h: 300 },
    large: { w: 400, h: 400 },
  },
  horizontal: {
    small: { w: 400, h: 200 },
    medium: { w: 600, h: 300 },
    large: { w: 800, h: 400 },
  },
  vertical: {
    small: { w: 200, h: 400 },
    medium: { w: 300, h: 500 },
    large: { w: 400, h: 600 },
  },
};

const SHAPE_OPTIONS: { value: Shape; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
];

const SIZE_OPTIONS: { value: Size; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

/* ------------------------------------------------------------------ */
/*  Pill toggle (M3 style)                                             */
/* ------------------------------------------------------------------ */

function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? "bg-primary text-on-primary"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Public helper — look up pixel dimensions                           */
/* ------------------------------------------------------------------ */

export function getDimensions(
  shape: Shape,
  size: Size,
): { w: number; h: number } {
  return DIMENSION_MAP[shape][size];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ShapeSizeSelector({
  shape,
  size,
  onShapeChange,
  onSizeChange,
}: ShapeSizeSelectorProps) {
  const { w, h } = getDimensions(shape, size);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
          Shape
        </span>
        <PillGroup
          options={SHAPE_OPTIONS}
          value={shape}
          onChange={onShapeChange}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
          Size
        </span>
        <PillGroup
          options={SIZE_OPTIONS}
          value={size}
          onChange={onSizeChange}
        />
      </div>

      <span className="text-xs text-on-surface-variant ml-auto tabular-nums">
        {w} &times; {h}px
      </span>
    </div>
  );
}
