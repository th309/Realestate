"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TIER_STYLES, type FeatureDefinition } from "./tier-types";

/** Draggable feature chip inside a tier column. */
export function FeatureChip({
  feature,
  tierSlug,
}: {
  feature: FeatureDefinition;
  tierSlug: string;
}) {
  const style = TIER_STYLES[tierSlug] || TIER_STYLES.free;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: feature.id,
    data: { feature, tierSlug },
  });

  const chipStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={chipStyle}
      {...attributes}
      {...listeners}
      className={`
        px-2 py-1 text-xs rounded border cursor-grab active:cursor-grabbing
        ${style.chip}
        ${isDragging ? "ring-2 ring-primary shadow-lg" : "hover:shadow-sm"}
        transition-shadow
      `}
      title={`${feature.slug}${feature.description ? "\n" + feature.description : ""}`}
    >
      {feature.name}
    </div>
  );
}

/** Ghost chip shown under cursor during drag. */
export function DragOverlayChip({
  feature,
}: {
  feature: FeatureDefinition | null;
}) {
  if (!feature) return null;
  return (
    <div className="px-3 py-1.5 text-xs rounded bg-primary text-white shadow-xl font-medium">
      {feature.name}
    </div>
  );
}
