'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  MapPin,
  FileText,
  User,
  Settings,
  Layers,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { USER_TYPE_CONFIG, SCORE_INFO } from '../../constants';
import type { UseWizardStateReturn } from '../../hooks/useWizardState';
import type { ReportSection, ReportPage } from '../../types';
import { DraggableSection, SectionPreview, type SectionItem } from './DraggableSection';

interface StepReviewProps {
  wizardState: UseWizardStateReturn;
}

// Convert template sections to draggable items
function sectionsToItems(pages: ReportPage[]): SectionItem[] {
  const items: SectionItem[] = [];
  const idCounts: Record<string, number> = {};

  pages.forEach((page, pageIndex) => {
    page.sections.forEach((section, sectionIndex) => {
      // Ensure unique IDs by appending page/section index if there are duplicates
      const baseId = section.id;
      idCounts[baseId] = (idCounts[baseId] || 0) + 1;
      const uniqueId = idCounts[baseId] > 1
        ? `${baseId}-${pageIndex}-${sectionIndex}`
        : baseId;

      items.push({
        id: uniqueId,
        type: section.type,
        name: section.config?.title || section.config?.name || '',
        description: section.config?.description,
        required: section.config?.required ?? ['report_title', 'report_metadata'].includes(section.type),
        enabled: true,
        collapsed: false,
      });
    });
  });
  return items;
}

export const StepReview: React.FC<StepReviewProps> = ({ wizardState }) => {
  const {
    userType,
    selectedTemplate,
    primaryGeography,
    comparisonGeographies,
    userInputs,
  } = wizardState;

  const userTypeConfig = USER_TYPE_CONFIG[userType];
  const heroScore = SCORE_INFO[userTypeConfig.heroScore];

  // Section ordering state
  const [sections, setSections] = useState<SectionItem[]>(() =>
    selectedTemplate ? sectionsToItems(selectedTemplate.config.pages) : []
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showSections, setShowSections] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const handleToggle = useCallback((id: string) => {
    setSections((items) =>
      items.map((item) =>
        item.id === id && !item.required ? { ...item, enabled: !item.enabled } : item
      )
    );
  }, []);

  const handleReset = useCallback(() => {
    if (selectedTemplate) {
      setSections(sectionsToItems(selectedTemplate.config.pages));
    }
  }, [selectedTemplate]);

  const activeSection = useMemo(
    () => sections.find((s) => s.id === activeId),
    [sections, activeId]
  );

  const enabledCount = sections.filter((s) => s.enabled).length;
  const totalCount = sections.length;

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-medium text-on-surface mb-2">Review Your Selections</h3>
        <p className="text-sm text-on-surface-variant">
          Confirm your report configuration before generating. You can also customize which sections to include.
        </p>
      </div>

      <div className="space-y-4">
        {/* User Type */}
        <div className="p-4 bg-surface-container rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <User className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-on-surface">User Type</span>
          </div>
          <div className="pl-8">
            <div className="font-medium text-on-surface">{userTypeConfig.label}</div>
            <div className="text-xs text-on-surface-variant mt-1">
              Hero Score: <span className={heroScore.color}>{heroScore.name}</span>
            </div>
          </div>
        </div>

        {/* Report Template */}
        <div className="p-4 bg-surface-container rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-on-surface">Report Template</span>
          </div>
          <div className="pl-8">
            <div className="font-medium text-on-surface">{selectedTemplate?.name}</div>
            <div className="text-xs text-on-surface-variant mt-1">{selectedTemplate?.description}</div>
          </div>
        </div>

        {/* Geography */}
        <div className="p-4 bg-surface-container rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-on-surface">
              {comparisonGeographies.length > 0 ? 'Markets' : 'Market'}
            </span>
          </div>
          <div className="pl-8 space-y-2">
            {primaryGeography && (
              <div>
                <div className="font-medium text-on-surface">{primaryGeography.name}</div>
                <div className="text-xs text-on-surface-variant">
                  Primary Market • {primaryGeography.state}
                </div>
              </div>
            )}
            {comparisonGeographies.map((geo) => (
              <div key={geo.id}>
                <div className="font-medium text-on-surface">{geo.name}</div>
                <div className="text-xs text-on-surface-variant">
                  Comparison Market • {geo.state}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Inputs (if any) */}
        {Object.keys(userInputs).length > 0 && (
          <div className="p-4 bg-surface-container rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Settings className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-on-surface">Custom Inputs</span>
            </div>
            <div className="pl-8 space-y-1">
              {selectedTemplate?.config.user_inputs
                .filter((input) => userInputs[input.field_name] !== undefined)
                .map((input) => (
                  <div key={input.field_name} className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">{input.label}</span>
                    <span className="font-medium text-on-surface">
                      {typeof userInputs[input.field_name] === 'boolean'
                        ? userInputs[input.field_name]
                          ? 'Yes'
                          : 'No'
                        : userInputs[input.field_name]}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Report Sections (Reorderable) */}
        <div className="p-4 bg-surface-container rounded-xl">
          <button
            onClick={() => setShowSections(!showSections)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-on-surface">Report Sections</span>
              <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                {enabledCount} of {totalCount}
              </span>
            </div>
            {showSections ? (
              <ChevronDown className="w-4 h-4 text-on-surface-variant" />
            ) : (
              <ChevronRight className="w-4 h-4 text-on-surface-variant" />
            )}
          </button>

          {showSections && (
            <div className="mt-4">
              {/* Reset Button */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-on-surface-variant">
                  Drag to reorder • Toggle visibility • Required sections cannot be hidden
                </p>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs text-on-surface-variant hover:text-primary rounded-lg hover:bg-primary/10 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Order
                </button>
              </div>

              {/* Draggable Sections List */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sections.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {sections.map((section) => (
                      <DraggableSection
                        key={section.id}
                        section={section}
                        onToggle={handleToggle}
                        isDragging={activeId === section.id}
                      />
                    ))}
                  </div>
                </SortableContext>

                <DragOverlay>
                  {activeSection && (
                    <DraggableSection
                      section={activeSection}
                      onToggle={() => {}}
                      isOverlay
                    />
                  )}
                </DragOverlay>
              </DndContext>
            </div>
          )}

          {/* Collapsed Preview */}
          {!showSections && (
            <div className="mt-3 pl-8 flex flex-wrap gap-2">
              {sections.slice(0, 5).map((section) => (
                <SectionPreview key={section.id} section={section} compact />
              ))}
              {sections.length > 5 && (
                <span className="px-2 py-1 text-xs text-on-surface-variant">
                  +{sections.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Generation Note */}
      <div className="mt-6 p-4 bg-primary-container/30 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/20 rounded-lg shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-medium text-on-surface text-sm">AI-Powered Analysis</div>
            <p className="text-xs text-on-surface-variant mt-1">
              Your report will include AI-generated insights tailored to your {userType === 'investor' ? 'investment' : 'homebuying'} goals. You&apos;ll be able to ask follow-up questions after generation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepReview;
