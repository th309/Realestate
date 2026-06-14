'use client';

import React, { useCallback, useState } from 'react';
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
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
  FileText,
  Save,
  Download,
  Undo,
  Redo,
  Trash2,
  Eye,
  Settings,
  Home,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { Breadcrumbs } from '@/components/navigation';
import { useBuilderState, SECTION_TEMPLATES, type BuilderSection } from './hooks/useBuilderState';
import { SectionLibrary } from './components/SectionLibrary';
import { Canvas } from './components/Canvas';
import { PropertyPanel } from './components/PropertyPanel';
import type { SectionType } from '../types';

export const Builder: React.FC = () => {
  const builderState = useBuilderState();
  const {
    title,
    setTitle,
    userType,
    setUserType,
    sections,
    selectedSectionId,
    addSection,
    removeSection,
    duplicateSection,
    updateSectionConfig,
    selectSection,
    reorderSections,
    clearCanvas,
    isDirty,
    selectedSection,
  } = builderState;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      // Check if dragging from library
      const isFromLibrary = (active.id as string).startsWith('library-');

      if (isFromLibrary) {
        // Add new section from library
        const sectionType = active.data.current?.type as SectionType;
        if (sectionType) {
          addSection(sectionType);
        }
      } else if (over.id !== active.id) {
        // Reorder existing sections
        const oldIndex = sections.findIndex((s) => s.id === active.id);
        const newIndex = sections.findIndex((s) => s.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(
            sections.map((s) => s.id),
            oldIndex,
            newIndex
          );
          reorderSections(newOrder);
        }
      }
    },
    [sections, addSection, reorderSections]
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Could use this for visual feedback while dragging
  }, []);

  // Get active section for drag overlay
  const getActiveDragItem = () => {
    if (!activeId) return null;

    if (activeId.startsWith('library-')) {
      const type = activeId.replace('library-', '') as SectionType;
      const template = SECTION_TEMPLATES[type];
      return {
        id: activeId,
        type,
        name: template?.name || type,
        description: template?.description,
      };
    }

    return sections.find((s) => s.id === activeId);
  };

  const activeItem = getActiveDragItem();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex flex-col bg-surface overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between gap-4 px-4 py-3 bg-surface-container border-b border-outline-variant">
          {/* Left: Breadcrumbs + Title */}
          <div className="flex items-center gap-4">
            <Breadcrumbs
              items={[
                { label: 'Reports', href: '/reports' },
                { label: 'Builder' },
              ]}
              className="text-sm"
            />
            <div className="h-6 w-px bg-outline-variant" />
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-lg font-medium text-on-surface bg-transparent border-none focus:outline-none focus:ring-0 w-64"
                placeholder="Untitled Report"
              />
              {isDirty && (
                <span className="px-1.5 py-0.5 text-[10px] bg-warning/20 text-warning rounded">
                  Unsaved
                </span>
              )}
            </div>
          </div>

          {/* Center: User Type Toggle */}
          <div className="flex items-center bg-surface-container-high rounded-xl p-1">
            <button
              onClick={() => setUserType('homebuyer')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                userType === 'homebuyer'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Home className="w-4 h-4" />
              Homebuyer
            </button>
            <button
              onClick={() => setUserType('investor')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                userType === 'investor'
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Investor
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={clearCanvas}
              disabled={sections.length === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-on-surface-variant hover:text-error hover:bg-error/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
            <button
              onClick={() => setIsPreviewOpen(true)}
              disabled={sections.length === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <div className="h-6 w-px bg-outline-variant" />
            <button
              disabled={sections.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Template
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Section Library */}
          <aside className="w-72 p-3 border-r border-outline-variant overflow-hidden">
            <SectionLibrary onAddSection={addSection} />
          </aside>

          {/* Center: Canvas */}
          <main className="flex-1 p-4 overflow-hidden">
            <Canvas
              sections={sections}
              selectedSectionId={selectedSectionId}
              onSelectSection={selectSection}
              onRemoveSection={removeSection}
              onDuplicateSection={duplicateSection}
            />
          </main>

          {/* Right Sidebar: Property Panel */}
          <aside className="w-72 p-3 border-l border-outline-variant overflow-hidden">
            <PropertyPanel
              section={selectedSection}
              onUpdateConfig={updateSectionConfig}
              onClose={() => selectSection(null)}
            />
          </aside>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeItem && (
            <div className="px-4 py-3 bg-primary-container border-2 border-primary rounded-xl shadow-2xl">
              <div className="text-sm font-medium text-on-primary-container">
                {activeItem.name || SECTION_TEMPLATES[activeItem.type as SectionType]?.name}
              </div>
              <div className="text-xs text-on-primary-container/70">
                {activeItem.description || SECTION_TEMPLATES[activeItem.type as SectionType]?.description}
              </div>
            </div>
          )}
        </DragOverlay>

        {/* AI Assist Floating Button */}
        <button className="fixed bottom-6 right-6 p-4 bg-tertiary text-on-tertiary rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all">
          <Sparkles className="w-6 h-6" />
        </button>
      </div>
    </DndContext>
  );
};

export default Builder;
