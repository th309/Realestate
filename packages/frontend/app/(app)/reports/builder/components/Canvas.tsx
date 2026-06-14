'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Copy,
  Trash2,
  Settings,
  FileText,
  LayoutGrid,
} from 'lucide-react';
import type { BuilderSection } from '../hooks/useBuilderState';
import { SECTION_TEMPLATES } from '../hooks/useBuilderState';

interface CanvasProps {
  sections: BuilderSection[];
  selectedSectionId: string | null;
  onSelectSection: (id: string | null) => void;
  onRemoveSection: (id: string) => void;
  onDuplicateSection: (id: string) => void;
}

interface CanvasSectionProps {
  section: BuilderSection;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

const CanvasSection: React.FC<CanvasSectionProps> = ({
  section,
  isSelected,
  onSelect,
  onRemove,
  onDuplicate,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const template = SECTION_TEMPLATES[section.type];
  const sectionName = section.name || template?.name || section.type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`
        group relative rounded-xl border-2 transition-all duration-200
        ${isDragging
          ? 'opacity-50 scale-[0.98] shadow-lg'
          : isSelected
            ? 'border-primary bg-primary-container/10 shadow-md'
            : 'border-outline-variant bg-surface-container-low hover:border-primary/30'
        }
      `}
    >
      {/* Section Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant/50">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-1 rounded cursor-grab active:cursor-grabbing text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Section Name */}
        <span className="flex-1 text-sm font-medium text-on-surface truncate">
          {sectionName}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
            title="Duplicate section"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1.5 rounded text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
            title="Remove section"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Section Preview */}
      <div className="p-4 min-h-[80px] flex items-center justify-center">
        <SectionPreview type={section.type} config={section.config} />
      </div>

      {/* Selected Indicator */}
      {isSelected && (
        <div className="absolute -right-2 -top-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
          <Settings className="w-3 h-3 text-on-primary" />
        </div>
      )}
    </div>
  );
};

// Simple preview placeholder for sections
const SectionPreview: React.FC<{ type: string; config: Record<string, unknown> }> = ({
  type,
  config,
}) => {
  const template = SECTION_TEMPLATES[type as keyof typeof SECTION_TEMPLATES];

  // Render placeholder based on section type
  switch (type) {
    case 'report_title':
      return (
        <div className="text-center">
          <div className="h-6 w-48 bg-on-surface/10 rounded mx-auto mb-2" />
          <div className="h-3 w-32 bg-on-surface/5 rounded mx-auto" />
        </div>
      );
    case 'score_gauge_single':
    case 'score_gauge_dual':
      return (
        <div className="flex items-center justify-center gap-4">
          <div className="w-20 h-20 rounded-full border-4 border-primary/30 flex items-center justify-center">
            <span className="text-lg font-bold text-primary">85</span>
          </div>
          {type === 'score_gauge_dual' && (
            <div className="w-20 h-20 rounded-full border-4 border-tertiary/30 flex items-center justify-center">
              <span className="text-lg font-bold text-tertiary">72</span>
            </div>
          )}
        </div>
      );
    case 'metric_grid':
      return (
        <div className="grid grid-cols-3 gap-2 w-full max-w-xs">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-2 bg-surface-container rounded">
              <div className="h-2 w-12 bg-on-surface/10 rounded mb-1" />
              <div className="h-4 w-8 bg-primary/20 rounded" />
            </div>
          ))}
        </div>
      );
    case 'chart_single':
    case 'chart_grid':
      return (
        <div className="w-full max-w-xs">
          <div className="h-24 border-l-2 border-b-2 border-on-surface/20 relative">
            <svg className="w-full h-full" preserveAspectRatio="none">
              <path
                d="M 0 80 Q 30 60, 60 50 T 120 30 T 180 40 T 240 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-primary/50"
              />
            </svg>
          </div>
        </div>
      );
    case 'ai_narrative':
      return (
        <div className="w-full max-w-xs space-y-1.5">
          <div className="h-2 w-full bg-on-surface/10 rounded" />
          <div className="h-2 w-5/6 bg-on-surface/10 rounded" />
          <div className="h-2 w-4/5 bg-on-surface/10 rounded" />
          <div className="h-2 w-3/4 bg-on-surface/10 rounded" />
        </div>
      );
    case 'comparison_table':
      return (
        <div className="w-full max-w-xs">
          <div className="grid grid-cols-3 gap-1">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className={`h-4 rounded ${i < 3 ? 'bg-primary/20' : 'bg-on-surface/10'}`}
              />
            ))}
          </div>
        </div>
      );
    default:
      return (
        <div className="flex flex-col items-center text-on-surface-variant">
          <LayoutGrid className="w-8 h-8 opacity-30 mb-1" />
          <span className="text-xs">{template?.name || type}</span>
        </div>
      );
  }
};

export const Canvas: React.FC<CanvasProps> = ({
  sections,
  selectedSectionId,
  onSelectSection,
  onRemoveSection,
  onDuplicateSection,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-drop-zone',
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        h-full rounded-2xl border-2 border-dashed transition-colors duration-200 p-4 overflow-y-auto
        ${isOver
          ? 'border-primary bg-primary-container/10'
          : sections.length === 0
            ? 'border-outline-variant bg-surface-container-lowest'
            : 'border-transparent bg-surface-container-lowest'
        }
      `}
      onClick={() => onSelectSection(null)}
    >
      {sections.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center">
          <FileText className="w-16 h-16 text-on-surface-variant opacity-20 mb-4" />
          <h3 className="text-lg font-medium text-on-surface-variant mb-2">
            Start Building Your Report
          </h3>
          <p className="text-sm text-on-surface-variant max-w-xs">
            Drag sections from the library on the left, or click the + button to add them here.
          </p>
        </div>
      ) : (
        <SortableContext
          items={sections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {sections.map((section) => (
              <CanvasSection
                key={section.id}
                section={section}
                isSelected={selectedSectionId === section.id}
                onSelect={() => onSelectSection(section.id)}
                onRemove={() => onRemoveSection(section.id)}
                onDuplicate={() => onDuplicateSection(section.id)}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
};

export default Canvas;
