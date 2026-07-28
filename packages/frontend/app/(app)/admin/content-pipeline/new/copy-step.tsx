"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import {
  FORMAT_MANIFEST,
  type CopyFieldDeclaration,
} from "@propertyiq/video-template/formats";
import { suggestCopy } from "../lib/copy-suggest-api";
import {
  chooseVariant,
  emptyCopyState,
  mergeSuggestions,
  setFieldValue,
  type CopyState,
} from "./copy-state";

export interface CopyStepProps {
  format: string;
  itemCount: number;
  state: CopyState | null;
  onStateChange: (next: CopyState) => void;
  onBack: () => void;
  onNext: () => void;
}

/**
 * Writes the video's on-screen text.
 *
 * Opens pre-filled rather than empty: staring at a blank hook field is the
 * point most people abandon, and a draft to react to is far easier than a
 * blank page. Every field is a normal input — the draft is a starting
 * position, not an answer, and anything typed here outranks a later
 * regenerate.
 */
export function CopyStep({
  format,
  itemCount,
  state,
  onStateChange,
  onBack,
  onNext,
}: CopyStepProps) {
  const manifest = FORMAT_MANIFEST[format as keyof typeof FORMAT_MANIFEST];
  const fields: CopyFieldDeclaration[] = manifest?.copyFields ?? [];

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const draft = useCallback(
    async (current: CopyState) => {
      setLoading(true);
      setNotice(null);
      try {
        const result = await suggestCopy({ formatKey: format, itemCount });
        onStateChange(mergeSuggestions(current, result.fields, fields));
        if (result.degraded) {
          // Say what happened. A silently empty form reads as a broken page.
          setNotice(
            `Couldn't draft copy just now (${result.reason ?? "unknown"}). Write your own and carry on.`,
          );
        }
      } catch (err) {
        setNotice(
          err instanceof Error
            ? `${err.message}. Write your own and carry on.`
            : "Copy service unavailable. Write your own and carry on.",
        );
      } finally {
        setLoading(false);
      }
    },
    [format, itemCount, fields, onStateChange],
  );

  // Draft once on arrival, never again automatically — a surprise refresh
  // mid-edit would be maddening.
  useEffect(() => {
    if (state === null && fields.length > 0) {
      const blank = emptyCopyState(fields, itemCount);
      onStateChange(blank);
      void draft(blank);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (fields.length === 0) {
    return (
      <div className="p-8">
        <p className="text-on-surface-variant">
          This format writes its own copy from market data.
        </p>
        <Nav onBack={onBack} onNext={onNext} disabled={false} />
      </div>
    );
  }

  const current = state ?? emptyCopyState(fields, itemCount);

  return (
    <div className="p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-on-surface">
            Write the hook and features
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Drafted for you. Change anything — what you write is kept.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void draft(current)}
          disabled={loading}
          className="flex shrink-0 items-center gap-2 rounded-full border border-outline px-4 py-2 text-sm font-semibold text-on-surface disabled:opacity-40"
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {loading ? "Drafting…" : "Redraft"}
        </button>
      </div>

      {notice && (
        <p className="mt-4 rounded-lg bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
          {notice}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {fields.map((field) => (
          <FieldGroup
            key={field.fieldId}
            field={field}
            slots={current[field.fieldId] ?? []}
            onEdit={(i, value) =>
              onStateChange(setFieldValue(current, field.fieldId, i, value))
            }
            onPick={(option) =>
              onStateChange(chooseVariant(current, field.fieldId, option))
            }
          />
        ))}
      </div>

      <Nav onBack={onBack} onNext={onNext} disabled={loading} />
    </div>
  );
}

function FieldGroup({
  field,
  slots,
  onEdit,
  onPick,
}: {
  field: CopyFieldDeclaration;
  slots: CopyState[string];
  onEdit: (index: number, value: string) => void;
  onPick: (option: string) => void;
}) {
  const options = slots[0]?.options ?? [];

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-on-surface">
        {field.label}
      </label>

      {slots.map((slot, i) => (
        <div key={i} className="flex flex-col gap-1">
          <input
            value={slot.value}
            maxLength={field.maxLength}
            onChange={(e) => onEdit(i, e.target.value)}
            placeholder={field.repeating ? `Feature ${i + 1}` : undefined}
            className="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-on-surface"
          />
          {/* The limit is the width of a box on screen, so show the room left. */}
          <span className="self-end text-xs text-on-surface-variant">
            {slot.value.length}/{field.maxLength}
          </span>
        </div>
      ))}

      {options.length > 1 && (
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <Sparkles className="h-3 w-3" />
            Other options
          </span>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onPick(option)}
              className={[
                "rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-200",
                option === slots[0]?.value
                  ? "border-primary bg-primary-container text-on-primary-container"
                  : "border-outline text-on-surface hover:border-primary",
              ].join(" ")}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Nav({
  onBack,
  onNext,
  disabled,
}: {
  onBack: () => void;
  onNext: () => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-8 flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="rounded-full border border-outline px-5 py-2 text-sm font-semibold text-on-surface"
      >
        Back
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-on-primary disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}
