'use client';

import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  BarChart3,
  PieChart,
  TrendingUp,
  GitCompare,
  Brain,
  Activity,
  Target,
  DollarSign,
  Users,
  Sparkles,
  Plus,
} from 'lucide-react';
import type { SectionType } from '../../types';
import { SECTION_TEMPLATES, SECTION_CATEGORIES } from '../hooks/useBuilderState';

// Icons for different section categories
const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  header: FileText,
  scores: Target,
  metrics: BarChart3,
  charts: PieChart,
  comparison: GitCompare,
  analysis: Brain,
  indicators: Activity,
  cycle: TrendingUp,
  scenarios: TrendingUp,
  affordability: DollarSign,
  migration: Users,
  investment: DollarSign,
  content: Sparkles,
};

interface SectionLibraryProps {
  onAddSection: (type: SectionType) => void;
}

interface DraggableSectionItemProps {
  type: SectionType;
  name: string;
  description: string;
  onAdd: () => void;
}

const DraggableSectionItem: React.FC<DraggableSectionItemProps> = ({
  type,
  name,
  description,
  onAdd,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${type}`,
    data: { type, isLibraryItem: true },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`
        group relative flex items-center gap-3 p-3 rounded-lg
        border border-outline-variant bg-surface-container-low
        cursor-grab active:cursor-grabbing
        hover:border-primary/50 hover:bg-surface-container
        transition-all duration-150
        ${isDragging ? 'opacity-50 scale-95' : ''}
      `}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-on-surface truncate">{name}</div>
        <div className="text-xs text-on-surface-variant truncate">{description}</div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-primary/10 text-primary hover:bg-primary/20 transition-all"
        title="Add to canvas"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};

export const SectionLibrary: React.FC<SectionLibraryProps> = ({ onAddSection }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['header', 'scores', 'metrics'])
  );

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Filter sections by search query
  const filteredCategories = SECTION_CATEGORIES.map((category) => ({
    ...category,
    sections: category.sections.filter((type) => {
      const template = SECTION_TEMPLATES[type];
      if (!template) return false;
      const searchLower = searchQuery.toLowerCase();
      return (
        template.name.toLowerCase().includes(searchLower) ||
        template.description.toLowerCase().includes(searchLower) ||
        type.toLowerCase().includes(searchLower)
      );
    }),
  })).filter((category) => category.sections.length > 0);

  return (
    <div className="h-full flex flex-col bg-surface-container rounded-2xl border border-outline-variant overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-outline-variant">
        <h3 className="text-base font-medium text-on-surface mb-3">Section Library</h3>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sections..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-outline-variant bg-surface-container-low text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* Section List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredCategories.map((category) => {
          const isExpanded = expandedCategories.has(category.id);
          const Icon = CATEGORY_ICONS[category.id] || FileText;

          return (
            <div key={category.id}>
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-container-high transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-on-surface-variant" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                )}
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-on-surface flex-1 text-left">
                  {category.name}
                </span>
                <span className="text-xs text-on-surface-variant px-1.5 py-0.5 bg-surface-container rounded">
                  {category.sections.length}
                </span>
              </button>

              {/* Category Sections */}
              {isExpanded && (
                <div className="mt-1 ml-6 space-y-1.5">
                  {category.sections.map((type) => {
                    const template = SECTION_TEMPLATES[type];
                    if (!template) return null;

                    return (
                      <DraggableSectionItem
                        key={type}
                        type={type}
                        name={template.name}
                        description={template.description}
                        onAdd={() => onAddSection(type)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredCategories.length === 0 && (
          <div className="text-center py-8">
            <Search className="w-8 h-8 text-on-surface-variant mx-auto mb-2 opacity-50" />
            <p className="text-sm text-on-surface-variant">No sections found</p>
          </div>
        )}
      </div>

      {/* Footer Tip */}
      <div className="p-3 border-t border-outline-variant bg-surface-container-low">
        <p className="text-xs text-on-surface-variant text-center">
          Drag sections to the canvas or click <Plus className="w-3 h-3 inline" /> to add
        </p>
      </div>
    </div>
  );
};

export default SectionLibrary;
