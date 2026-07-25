/**
 * @dnd-kit droppable wrapper for one calendar day. The day key is the droppable
 * id, so the page's onDragEnd reads over.id to know which ET day a post was
 * dropped on. `className` is a function of the hover state so the caller emits
 * exactly one set of classes per state (no Tailwind border/bg conflicts).
 */
import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";

export function DroppableDay({
  dayKey,
  className,
  children,
}: {
  dayKey: string;
  className: (isOver: boolean) => string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey });
  return (
    <div ref={setNodeRef} className={className(isOver)}>
      {children}
    </div>
  );
}
