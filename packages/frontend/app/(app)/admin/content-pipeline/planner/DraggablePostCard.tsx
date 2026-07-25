/**
 * @dnd-kit draggable wrapper around a PostCard. Keeps PostCard itself
 * presentational (so it can also render in the DragOverlay). Drag listeners and
 * ARIA drag semantics live on the wrapper; the in-place card dims while it's
 * the one being dragged.
 */
import { useDraggable } from "@dnd-kit/core";
import type { PlannerPost } from "../lib/posts-api";
import { PostCard } from "./PostCard";
import { formatEtTime } from "./planner-tz";

export function DraggablePostCard({
  post,
  showHook = true,
  onReschedule,
}: {
  post: PlannerPost;
  showHook?: boolean;
  onReschedule?: (post: PlannerPost, iso: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: post.id,
    data: { post },
  });

  // Give the focusable drag handle its own accessible name — otherwise the
  // wrapper's name is the jumbled concatenation of all descendant text
  // (including the nested clock button). aria-label after {...attributes}
  // overrides dnd-kit's aria-* so this wins.
  const time = post.scheduled_at ? formatEtTime(post.scheduled_at) : null;
  const dragLabel = `Drag to reschedule: ${post.platform} ${post.post_type.replace(
    /_/g,
    " ",
  )}${time ? ` at ${time}` : ""}`;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={dragLabel}
      className={`cursor-grab touch-none rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <PostCard post={post} showHook={showHook} onReschedule={onReschedule} />
    </div>
  );
}
