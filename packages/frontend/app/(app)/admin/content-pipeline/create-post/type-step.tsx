/**
 * Step 1 (shown only when the kind isn't preselected): pick a single image post
 * or a multi-slide carousel. Two large, equal-weight choice cards — this is a
 * fork, not a ranked list, so neither is styled as the default.
 */
import type { GeneratePostType } from "../lib/posts-api";

const CHOICES: {
  type: Extract<GeneratePostType, "image_post" | "carousel">;
  title: string;
  blurb: string;
  icon: React.ReactNode;
}[] = [
  {
    type: "image_post",
    title: "Single image post",
    blurb: "One graphic grounded in a market's numbers.",
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="M21 16l-5-5-6 6" />
      </svg>
    ),
  },
  {
    type: "carousel",
    title: "Carousel",
    blurb: "A swipeable set of slides from one market story.",
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="7" y="5" width="10" height="14" rx="2" />
        <path d="M4 8v8M20 8v8" />
      </svg>
    ),
  },
];

export function TypeStep({
  onPick,
}: {
  onPick: (type: "image_post" | "carousel") => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {CHOICES.map((choice) => (
        <button
          key={choice.type}
          type="button"
          onClick={() => onPick(choice.type)}
          className="group flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-6 text-left shadow-sm transition-shadow duration-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-container text-on-primary-container transition-transform duration-200 group-hover:-translate-y-0.5">
            {choice.icon}
          </span>
          <span className="text-base font-semibold text-on-surface">
            {choice.title}
          </span>
          <span className="text-sm text-on-surface-variant">
            {choice.blurb}
          </span>
        </button>
      ))}
    </div>
  );
}
