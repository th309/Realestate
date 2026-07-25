/**
 * A single task tile. Live tasks link to their flow; not-yet-built tasks
 * render as a quiet, non-interactive "Coming soon" placeholder so the home
 * layout reads as complete from day one.
 */
import Link from "next/link";
import type { TaskDefinition } from "./taskCatalog";

export function TaskCard({ task }: { task: TaskDefinition }) {
  if (task.comingSoon || !task.href) {
    return (
      <div
        aria-disabled
        className="group relative flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface p-5 opacity-70"
      >
        <IconTile task={task} />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-on-surface">{task.title}</span>
            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Soon
            </span>
          </div>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            {task.subtitle}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={task.href}
      className="group relative flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-5 shadow-sm transition-shadow duration-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <IconTile task={task} />
      <div>
        <span className="font-medium text-on-surface">{task.title}</span>
        <p className="mt-0.5 text-sm text-on-surface-variant">
          {task.subtitle}
        </p>
      </div>
    </Link>
  );
}

/**
 * The live primary action (Videos) gets a filled indigo tile so it reads as
 * the one thing you can do right now; everything else gets a quiet tint.
 */
function IconTile({ task }: { task: TaskDefinition }) {
  const live = !task.comingSoon && Boolean(task.href);
  const tone = task.accent
    ? "bg-primary text-on-primary"
    : live
      ? "bg-primary-container text-on-primary-container"
      : "bg-surface-container-high text-on-surface-variant";
  return (
    <span
      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${tone} ${
        live
          ? "transition-transform duration-200 group-hover:-translate-y-0.5"
          : ""
      }`}
    >
      {task.icon}
    </span>
  );
}
