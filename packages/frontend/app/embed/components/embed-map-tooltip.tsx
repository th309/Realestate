import React from "react";

export interface TooltipData {
  name: string;
  value: number | null;
  x: number;
  y: number;
}

export interface EmbedMapTooltipProps {
  data: TooltipData;
  onClose: () => void;
}

/**
 * EmbedMapTooltip — Click-triggered tooltip overlay for the embed mini-map.
 *
 * Positioned near the click point, shows region name and formatted value.
 * Clicking elsewhere (handled by parent) dismisses the tooltip.
 */
export function EmbedMapTooltip({ data, onClose }: EmbedMapTooltipProps) {
  const displayValue = data.value != null ? data.value.toLocaleString() : "N/A";

  return (
    <div
      className="absolute z-10 pointer-events-auto"
      style={{
        left: data.x,
        top: data.y,
        transform: "translate(-50%, -110%)",
      }}
    >
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 min-w-[120px]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-gray-900 leading-tight">
              {data.name}
            </span>
            <span className="text-sm font-bold text-gray-900">
              {displayValue}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xs leading-none p-0.5"
            aria-label="Close tooltip"
          >
            &times;
          </button>
        </div>
      </div>
      {/* Tooltip arrow */}
      <div className="flex justify-center">
        <div className="w-2 h-2 bg-white border-r border-b border-gray-200 transform rotate-45 -mt-1" />
      </div>
    </div>
  );
}
