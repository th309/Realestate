"use client";

import React from "react";
import {
  Target,
  BarChart3,
  Map,
  Globe,
  TrendingUp,
  FileText,
} from "lucide-react";
import { WIDGET_TYPES, type WidgetType } from "../embed-builder-types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Target,
  BarChart3,
  Map,
  Globe,
  TrendingUp,
  FileText,
};

interface StepChooseWidgetProps {
  selectedType: WidgetType | null;
  onSelect: (type: WidgetType) => void;
}

export function StepChooseWidget({
  selectedType,
  onSelect,
}: StepChooseWidgetProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-on-surface">
        What do you want to show?
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {WIDGET_TYPES.map((widget) => {
          const Icon = ICON_MAP[widget.iconName];
          const isSelected = selectedType === widget.type;

          return (
            <button
              key={widget.type}
              type="button"
              onClick={() => onSelect(widget.type)}
              className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-200 text-center ${
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-outline-variant bg-surface hover:border-primary/40 hover:bg-surface-container-low"
              }`}
            >
              {Icon && (
                <Icon
                  className={`w-7 h-7 ${
                    isSelected ? "text-primary" : "text-on-surface-variant"
                  }`}
                />
              )}
              <div>
                <div
                  className={`text-sm font-medium ${
                    isSelected ? "text-primary" : "text-on-surface"
                  }`}
                >
                  {widget.label}
                </div>
                <div className="text-xs text-on-surface-variant mt-0.5">
                  {widget.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
