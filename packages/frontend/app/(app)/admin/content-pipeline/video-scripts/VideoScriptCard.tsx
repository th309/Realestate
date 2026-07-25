"use client";

import { useState } from "react";
import Link from "next/link";
import type { PlannerPost } from "../lib/posts-api";
import { PlatformGlyph } from "../planner/platform-glyph";
import { FORMAT_META } from "../lib/format-previews";
import {
  normalizeVideoScript,
  buildMakeVideoHref,
  scriptToPlainText,
} from "./video-script-copy";

/**
 * One video-script suggestion. Text-forward by design — the script IS the
 * payload, so the card leads with the title/hook and expands to the full
 * structured script. The primary action hands off to the run wizard prefilled
 * to turn this idea into an actual video.
 */
export function VideoScriptCard({
  post,
  onSkip,
  skipping = false,
}: {
  post: PlannerPost;
  onSkip: (id: string) => void;
  skipping?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const script = normalizeVideoScript(post);
  const formatMeta = script.suggestedFormat
    ? FORMAT_META[script.suggestedFormat]
    : null;
  const showHookLine = script.hook != null && script.hook !== script.title;

  async function copyScript() {
    try {
      await navigator.clipboard.writeText(scriptToPlainText(script));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — no-op, the script is still readable inline */
    }
  }

  return (
    <article className="flex flex-col rounded-xl border border-outline-variant bg-surface-container-low p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <PlatformGlyph platform={script.platform} />
        {script.durationSeconds != null && (
          <Chip>~{script.durationSeconds}s</Chip>
        )}
        {formatMeta && <Chip>{formatMeta.displayName}</Chip>}
      </div>

      <h3 className="mt-3 text-base font-semibold leading-snug text-on-surface">
        {script.title}
      </h3>
      {showHookLine && (
        <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
          {script.hook}
        </p>
      )}

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-outline-variant pt-3">
          {script.hook && <ScriptBlock label="Hook" text={script.hook} />}
          {script.body && <ScriptBlock label="Body" text={script.body} />}
          {script.close && <ScriptBlock label="Close" text={script.close} />}
          {script.sceneDirection && (
            <ScriptBlock label="Scene direction" text={script.sceneDirection} />
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 self-start text-xs font-semibold text-primary transition-colors duration-200 hover:text-primary/80"
        aria-expanded={expanded}
      >
        {expanded ? "Hide script" : "Read script"}
      </button>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-outline-variant pt-4">
        <Link
          href={buildMakeVideoHref(post)}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Make this video
        </Link>
        <button
          type="button"
          onClick={copyScript}
          className="rounded-full px-3.5 py-2 text-sm font-medium text-on-surface transition-colors duration-200 hover:bg-surface-container-high"
        >
          {copied ? "Copied" : "Copy script"}
        </button>
        <button
          type="button"
          onClick={() => onSkip(post.id)}
          disabled={skipping}
          className="ml-auto rounded-full px-3.5 py-2 text-sm font-medium text-on-surface-variant transition-colors duration-200 hover:bg-surface-container-high disabled:opacity-50"
        >
          Skip
        </button>
      </div>
    </article>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
      {children}
    </span>
  );
}

function ScriptBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-on-surface">
        {text}
      </p>
    </div>
  );
}
