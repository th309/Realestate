'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  FileText,
  GripVertical,
  Target,
  BarChart3,
  TrendingUp,
  Plus,
} from 'lucide-react';

// Sample sections for the preview
const AVAILABLE_SECTIONS = [
  { id: 'score', icon: Target, label: 'Score Gauge', color: 'primary' },
  { id: 'metrics', icon: BarChart3, label: 'Key Metrics', color: 'tertiary' },
  { id: 'trends', icon: TrendingUp, label: 'Price Trends', color: 'secondary' },
];

const INITIAL_SECTIONS = [
  { id: 'sec-1', type: 'score', label: 'HomeReady Score' },
  { id: 'sec-2', type: 'metrics', label: 'Market Metrics' },
];

export function BuilderPreview() {
  const [sections, setSections] = useState(INITIAL_SECTIONS);
  const [draggedSection, setDraggedSection] = useState<string | null>(null);

  const addSection = (type: string) => {
    const template = AVAILABLE_SECTIONS.find(s => s.id === type);
    if (template && sections.length < 4) {
      setSections([...sections, {
        id: `sec-${Date.now()}`,
        type,
        label: template.label,
      }]);
    }
  };

  const removeSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };

  const getIcon = (type: string) => {
    const template = AVAILABLE_SECTIONS.find(s => s.id === type);
    return template?.icon || FileText;
  };

  return (
    <div className="relative w-full h-full min-h-[320px] bg-surface-container rounded-xl overflow-hidden">
      {/* Builder header */}
      <div className="px-4 py-3 border-b border-outline-variant/50 flex items-center gap-3">
        <FileText className="w-4 h-4 text-primary" />
        <input
          type="text"
          defaultValue="Austin Market Report"
          className="flex-1 text-sm font-medium bg-transparent border-none focus:outline-none text-on-surface"
          readOnly
        />
        <div className="px-2 py-0.5 bg-primary-container text-on-primary-container text-xs rounded">
          Draft
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex h-[calc(100%-52px)]">
        {/* Left: Section library */}
        <div className="w-28 border-r border-outline-variant/50 p-2">
          <div className="text-[10px] font-medium text-on-surface-variant mb-2 px-1">
            Add Section
          </div>
          <div className="space-y-1">
            {AVAILABLE_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isAdded = sections.some(s => s.type === section.id);
              return (
                <button
                  key={section.id}
                  onClick={() => addSection(section.id)}
                  disabled={sections.length >= 4}
                  className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-colors ${
                    isAdded
                      ? 'bg-primary-container/30 text-on-surface-variant'
                      : 'hover:bg-surface-container-high text-on-surface'
                  } ${sections.length >= 4 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Icon className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-[10px] truncate">{section.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 p-3 bg-surface-container-low overflow-y-auto">
          <div className="space-y-2">
            {sections.map((section, index) => {
              const Icon = getIcon(section.type);
              return (
                <div
                  key={section.id}
                  draggable
                  onDragStart={() => setDraggedSection(section.id)}
                  onDragEnd={() => setDraggedSection(null)}
                  className={`
                    group bg-surface rounded-lg border border-outline-variant/50 p-2.5
                    cursor-grab active:cursor-grabbing transition-all
                    hover:border-primary/30 hover:shadow-sm
                    ${draggedSection === section.id ? 'opacity-50 scale-[0.98]' : ''}
                  `}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-3 h-3 text-on-surface-variant" />
                    <div className="w-6 h-6 rounded bg-primary-container/50 flex items-center justify-center">
                      <Icon className="w-3 h-3 text-primary" />
                    </div>
                    <span className="flex-1 text-xs font-medium text-on-surface">
                      {section.label}
                    </span>
                    <button
                      onClick={() => removeSection(section.id)}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-error/10 text-on-surface-variant hover:text-error transition-all"
                    >
                      <Plus className="w-3 h-3 rotate-45" />
                    </button>
                  </div>

                  {/* Section preview placeholder */}
                  <div className="mt-2 h-8 bg-surface-container-low rounded flex items-center justify-center">
                    {section.type === 'score' && (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center">
                          <span className="text-[10px] font-bold text-primary">87</span>
                        </div>
                        <div className="text-[9px] text-on-surface-variant">Great for families</div>
                      </div>
                    )}
                    {section.type === 'metrics' && (
                      <div className="flex gap-3">
                        {[{ v: '$485K', l: 'Price' }, { v: '+5.2%', l: 'Growth' }].map((m) => (
                          <div key={m.l} className="text-center">
                            <div className="text-[10px] font-bold text-on-surface">{m.v}</div>
                            <div className="text-[8px] text-on-surface-variant">{m.l}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {section.type === 'trends' && (
                      <svg viewBox="0 0 60 20" className="w-14 h-5">
                        <path
                          d="M0,15 Q15,12 25,10 T50,5 T60,3"
                          fill="none"
                          className="stroke-primary"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Drop zone hint */}
            {sections.length < 4 && (
              <div className="border-2 border-dashed border-outline-variant/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-on-surface-variant">
                  Drag sections here or click to add
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-surface-container via-surface-container to-transparent">
        <Link
          href="/reports"
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Create Your Report
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
