/**
 * One labelled group of task tiles (Create / Repurpose). The eyebrow label
 * encodes a real distinction — new work vs. transforming existing work — not
 * decoration.
 */
import { TaskCard } from "./TaskCard";
import type { TaskGroupDefinition } from "./taskCatalog";

export function TaskGroup({ group }: { group: TaskGroupDefinition }) {
  return (
    <section aria-labelledby={`task-group-${group.id}`}>
      <div className="mb-3 flex items-baseline gap-3">
        <h2
          id={`task-group-${group.id}`}
          className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant"
        >
          {group.label}
        </h2>
        <span className="text-sm text-on-surface-variant">{group.hint}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {group.tasks.map((task) => (
          <TaskCard key={task.key} task={task} />
        ))}
      </div>
    </section>
  );
}
