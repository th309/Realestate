/**
 * Task catalog for the studio home.
 *
 * Two groups mirror the two real modes of work: CREATE (make something new)
 * and REPURPOSE (transform something you already made). Each card either
 * links to a live flow (`href`) or is a visible "Coming soon" placeholder so
 * the layout is complete from day one. Adding a real flow later = flip
 * `comingSoon` off and set `href` — no layout change.
 *
 * Single export (`TASK_GROUPS`) keeps this a data module, not a component file.
 */
import type { ReactNode } from "react";

export interface TaskDefinition {
  key: string;
  title: string;
  subtitle: string;
  /** Present only when the flow exists today. */
  href?: string;
  /** True → rendered as a disabled placeholder. */
  comingSoon?: boolean;
  /** The one live, primary action gets the filled indigo icon tile. */
  accent?: boolean;
  icon: ReactNode;
}

export interface TaskGroupDefinition {
  id: string;
  label: string;
  hint: string;
  tasks: TaskDefinition[];
}

const iconProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ScriptIcon = (
  <svg {...iconProps} aria-hidden>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M14 3v5h5" />
    <path d="M9 12h7M9 16h7" />
  </svg>
);

const VideoIcon = (
  <svg {...iconProps} aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M10 9.2v5.6l5-2.8z" fill="currentColor" stroke="none" />
  </svg>
);

const CarouselIcon = (
  <svg {...iconProps} aria-hidden>
    <rect x="7" y="5" width="10" height="14" rx="2" />
    <path d="M4 8v8M20 8v8" />
  </svg>
);

const TopicToPostIcon = (
  <svg {...iconProps} aria-hidden>
    <path d="M12 3l1.6 3.9L17.5 8l-3.1 2.4.9 4L12 12.3 8.7 14.4l.9-4L6.5 8l3.9-1.1z" />
    <path d="M5 19h14" />
  </svg>
);

const ClipsIcon = (
  <svg {...iconProps} aria-hidden>
    <circle cx="6" cy="7" r="2.5" />
    <circle cx="6" cy="17" r="2.5" />
    <path d="M8 8.5L20 17M8 15.5L20 7" />
  </svg>
);

const ResizeIcon = (
  <svg {...iconProps} aria-hidden>
    <rect x="4" y="6" width="16" height="12" rx="2" />
    <path d="M9 9l-2.5 3L9 15M15 9l2.5 3L15 15" />
  </svg>
);

const CaptionsIcon = (
  <svg {...iconProps} aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M8 11.5a2 2 0 100 3M15.5 11.5a2 2 0 100 3" />
  </svg>
);

export const TASK_GROUPS: TaskGroupDefinition[] = [
  {
    id: "create",
    label: "Create",
    hint: "Start something new from live market data.",
    tasks: [
      {
        key: "video-scripts",
        title: "Video scripts",
        subtitle: "Draft a script before you render.",
        href: "/admin/content-pipeline/video-scripts",
        icon: ScriptIcon,
      },
      {
        key: "videos",
        title: "Videos",
        subtitle: "Turn a market into a short video.",
        href: "/admin/content-pipeline/new",
        accent: true,
        icon: VideoIcon,
      },
      {
        key: "carousels",
        title: "Carousels & images",
        subtitle: "Multi-slide posts and graphics.",
        href: "/admin/content-pipeline/create-post",
        icon: CarouselIcon,
      },
      {
        key: "topic-to-post",
        title: "Topic → post",
        subtitle: "Go from an idea to a ready draft.",
        href: "/admin/content-pipeline/create-post?type=from_topic",
        icon: TopicToPostIcon,
      },
    ],
  },
  {
    id: "repurpose",
    label: "Repurpose",
    hint: "Transform something you already made.",
    tasks: [
      {
        key: "clips",
        title: "Clips",
        subtitle: "Cut long videos into short clips.",
        comingSoon: true,
        icon: ClipsIcon,
      },
      {
        key: "resize-video",
        title: "Resize video",
        subtitle: "Reframe for every platform.",
        comingSoon: true,
        icon: ResizeIcon,
      },
      {
        key: "add-captions",
        title: "Add captions",
        subtitle: "Burn in captions automatically.",
        comingSoon: true,
        icon: CaptionsIcon,
      },
    ],
  },
];
