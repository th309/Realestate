"use client";

import {
  STRENGTH_STEPS,
  strengthStepFor,
  type StylePreferences,
} from "../../lib/style-preferences";

/**
 * Shows what is actually steering generation right now: which saved references
 * are in play, how strongly, and the exact prompt text they produce.
 *
 * The prompt text is shown verbatim rather than described, because when a post
 * comes out wrong this is the first thing an operator needs to read.
 */
export function StyleSignalPanel({
  preferences,
  onChangeStrength,
  busy,
}: {
  preferences: StylePreferences | undefined;
  onChangeStrength: (weight: number) => void;
  busy: boolean;
}) {
  if (!preferences) return null;

  const active = preferences.savedStyleRefs.filter((r) => r.exists);
  const removed = preferences.savedStyleRefs.length - active.length;
  const step = strengthStepFor(preferences.signalWeight);
  const steering = active.length > 0 && preferences.signalWeight > 0;

  return (
    <section className="rounded-xl bg-surface-container-low shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant">
            Steering generation
          </h2>
          <p className="text-sm text-on-surface mt-1.5">
            {steering ? (
              <>
                {active.length}{" "}
                {active.length === 1 ? "style shapes" : "styles shape"} how new
                posts are written.
              </>
            ) : active.length > 0 ? (
              "Saved styles are muted. Pick a strength to bring them back."
            ) : (
              "No styles are steering generation yet. Save a reference below to shape how new posts look."
            )}
          </p>
        </div>

        <StrengthDial
          activeLabel={step.label}
          onChange={onChangeStrength}
          busy={busy}
        />
      </div>

      {active.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {active.map((ref) => (
            <li
              key={ref.style_reference_id}
              className="rounded-full bg-secondary-container text-on-secondary-container px-3 py-1 text-xs font-medium"
            >
              {ref.label}
            </li>
          ))}
        </ul>
      )}

      {removed > 0 && (
        <p className="text-[11px] text-on-surface-variant">
          {removed} saved {removed === 1 ? "reference was" : "references were"}{" "}
          deleted from the library and no longer count.
        </p>
      )}

      {preferences.stylePreamble && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-primary hover:bg-primary/8 rounded-full px-2 py-1 -ml-2 inline-block transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Read the exact prompt text
          </summary>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-container p-4 text-[11px] leading-relaxed text-on-surface-variant whitespace-pre-wrap">
            {preferences.stylePreamble}
          </pre>
        </details>
      )}
    </section>
  );
}

/**
 * The four settings that mean something to generation. A continuous slider
 * would imply precision the model does not actually respond to.
 */
function StrengthDial({
  activeLabel,
  onChange,
  busy,
}: {
  activeLabel: string;
  onChange: (weight: number) => void;
  busy: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Style strength"
      className="inline-flex rounded-full border border-outline overflow-hidden shrink-0"
    >
      {STRENGTH_STEPS.map((s) => {
        const isActive = s.label === activeLabel;
        return (
          <button
            key={s.label}
            type="button"
            aria-pressed={isActive}
            disabled={busy}
            onClick={() => onChange(s.weight)}
            className={`px-3 py-1.5 text-xs font-medium border-r border-outline last:border-r-0 disabled:opacity-50 transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
              isActive
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-surface text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
