/**
 * StatusChip — the single plain-language surface for pipeline state.
 *
 * The pipeline runs on 14 internal state-machine names (queued, scripting,
 * rendering_video, …). Operators should never see those. This maps every
 * state into one of a handful of plain-language buckets and renders a small
 * M3 chip (tinted pill + status dot). Other pages can adopt the same
 * vocabulary by importing `pipelineStateToStatusChip` — keep this the one
 * place that decides what a state is *called*.
 */
import type { PipelineStatus } from "../../lib/content-pipeline-api";

export type StatusChipTone =
  | "generating"
  | "review"
  | "scheduled"
  | "published"
  | "attention"
  | "muted";

export interface StatusChipDescriptor {
  label: string;
  tone: StatusChipTone;
}

/**
 * Map a raw pipeline state to its plain-language chip. Accepts a loose
 * string so callers holding an untyped `status` (review-queue items,
 * dashboard runs) don't have to cast — unknown states fall back to "muted".
 */
export function pipelineStateToStatusChip(
  status: PipelineStatus | string | null | undefined,
): StatusChipDescriptor {
  switch (status) {
    case "queued":
    case "fetching_data":
    case "scripting":
    case "verifying_data":
    case "linting_voice":
    case "rendering_voice":
    case "timing_captions":
    case "rendering_video":
    case "publishing":
      return { label: "Generating", tone: "generating" };
    case "ready_for_review":
      return { label: "Ready to review", tone: "review" };
    case "published":
      return { label: "Published", tone: "published" };
    case "published_partial":
      // Live on some platforms, failed on others — worth an operator's eyes.
      return { label: "Needs attention", tone: "attention" };
    case "failed":
      return { label: "Needs attention", tone: "attention" };
    case "rejected":
    case "cancelled":
      return { label: "Closed", tone: "muted" };
    default:
      return { label: "Closed", tone: "muted" };
  }
}

/**
 * Map a `posts` lifecycle status to its plain-language chip. Post statuses are
 * a different vocabulary from the pipeline states above, but share the same
 * tones and StatusChip component. This is where the "scheduled" tone (reserved
 * until now) earns its keep.
 */
export function postStatusToStatusChip(
  status: string | null | undefined,
): StatusChipDescriptor {
  switch (status) {
    case "draft":
      return { label: "Draft", tone: "muted" };
    case "pending_review":
      return { label: "Needs review", tone: "review" };
    case "approved":
      return { label: "Approved", tone: "generating" };
    case "scheduled":
      return { label: "Scheduled", tone: "scheduled" };
    case "published":
      return { label: "Published", tone: "published" };
    case "failed":
      return { label: "Failed", tone: "attention" };
    case "skipped":
      return { label: "Skipped", tone: "muted" };
    default:
      return { label: "Draft", tone: "muted" };
  }
}

/** Tone → Tailwind classes. All semantic M3 tokens (see globals.css). */
export const STATUS_CHIP_TONE_CLASSES: Record<
  StatusChipTone,
  { pill: string; dot: string }
> = {
  generating: {
    pill: "bg-secondary-container text-on-secondary-container",
    dot: "bg-secondary",
  },
  review: {
    pill: "bg-primary-container text-on-primary-container",
    dot: "bg-primary",
  },
  scheduled: {
    pill: "bg-surface-container-high text-on-surface-variant",
    dot: "bg-outline",
  },
  published: {
    pill: "bg-tertiary-container text-on-tertiary-container",
    dot: "bg-tertiary",
  },
  attention: {
    pill: "bg-warning-container text-on-warning-container",
    dot: "bg-warning",
  },
  muted: {
    pill: "bg-surface-container-high text-on-surface-variant",
    dot: "bg-outline-variant",
  },
};

export interface StatusChipProps {
  /** A raw pipeline state — mapped to a plain-language label automatically. */
  status?: PipelineStatus | string | null;
  /** Or drive the chip directly (used by the in-flight ticker). */
  tone?: StatusChipTone;
  label?: string;
  /** Optional leading count, e.g. "3 · Generating". */
  count?: number;
  className?: string;
}

/**
 * Small status pill. Pass `status` to map a pipeline state, or `tone`+`label`
 * to render a bucket directly. The "generating" dot pulses (respecting
 * prefers-reduced-motion) to signal live work.
 */
export function StatusChip({
  status,
  tone,
  label,
  count,
  className = "",
}: StatusChipProps) {
  const descriptor: StatusChipDescriptor =
    tone && label ? { tone, label } : pipelineStateToStatusChip(status ?? null);
  const classes = STATUS_CHIP_TONE_CLASSES[descriptor.tone];
  const pulse = descriptor.tone === "generating";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${classes.pill} ${className}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${classes.dot} ${
          pulse ? "motion-safe:animate-pulse" : ""
        }`}
      />
      {typeof count === "number" && (
        <span className="font-mono tabular-nums">{count}</span>
      )}
      <span>{descriptor.label}</span>
    </span>
  );
}
