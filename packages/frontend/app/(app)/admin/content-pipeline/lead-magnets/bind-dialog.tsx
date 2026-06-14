"use client";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { M3Dialog } from "../components/m3-dialog";
import { useToast } from "../lib/toast";
import {
  createBinding,
  type FormatBinding,
  type MagnetDefinition,
} from "../lib/magnet-api";

const FORMATS = [
  "grade_reveal",
  "top_10_ranking",
  "score_mover",
  "head_to_head",
  "long_form_deep_dive",
  "farm_area_spotlight",
  "brokerage_market_share",
  "recruitment_angle",
] as const;

const QUERY_KEY = ["content-pipeline-magnets"] as const;

/**
 * M3 dialog to create a new format → magnet binding. Disables formats
 * that already have a binding to the selected magnet (UNIQUE constraint
 * in the schema).
 */
export function BindDialog({
  open,
  onClose,
  magnets,
  existingBindings,
}: {
  open: boolean;
  onClose: () => void;
  magnets: MagnetDefinition[];
  existingBindings: FormatBinding[];
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [format, setFormat] = useState<string>(FORMATS[0]);
  const [magnetKind, setMagnetKind] = useState<string>(magnets[0]?.kind ?? "");
  const [ctaText, setCtaText] = useState("Get the free PDF");
  const [weight, setWeight] = useState(1.0);

  useEffect(() => {
    if (open) {
      setFormat(FORMATS[0]);
      setMagnetKind(
        magnets.find((m) => m.enabled)?.kind ?? magnets[0]?.kind ?? "",
      );
      setCtaText("Get the free PDF");
      setWeight(1.0);
    }
  }, [open, magnets]);

  const createMut = useMutation({
    mutationFn: createBinding,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Binding created");
      onClose();
    },
    onError: (err: Error) =>
      toast.error(`Bind failed: ${err.message.slice(0, 100)}`),
  });

  const conflict = existingBindings.some(
    (b) => b.format === format && b.magnet_kind === magnetKind,
  );

  return (
    <M3Dialog
      open={open}
      onClose={createMut.isPending ? () => {} : onClose}
      ariaLabel="Bind magnet to format"
      maxWidth="max-w-lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (conflict) return;
          createMut.mutate({
            format,
            magnet_kind: magnetKind,
            cta_text: ctaText.trim(),
            weight,
          });
        }}
      >
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-medium text-on-surface">Bind a magnet</h2>

          <Field label="Format">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full bg-surface text-on-surface rounded-lg border border-outline px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Magnet">
            <select
              value={magnetKind}
              onChange={(e) => setMagnetKind(e.target.value)}
              className="w-full bg-surface text-on-surface rounded-lg border border-outline px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              {magnets.map((m) => (
                <option key={m.kind} value={m.kind} disabled={!m.enabled}>
                  {m.display_name} {m.enabled ? "" : "(disabled)"}
                </option>
              ))}
            </select>
          </Field>

          <Field label="CTA text">
            <input
              type="text"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              required
              className="w-full bg-surface text-on-surface rounded-lg border border-outline px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </Field>

          <Field label={`Weight: ${weight.toFixed(2)}`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="text-[11px] text-on-surface-variant mt-1">
              Used for A/B between multiple magnets bound to the same format.
              1.0 means always pick this one.
            </p>
          </Field>

          {conflict && (
            <p className="text-xs text-error">
              {format} is already bound to {magnetKind}. Edit the existing
              binding instead.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            disabled={createMut.isPending}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-on-surface hover:bg-on-surface/8 disabled:opacity-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMut.isPending || conflict || !magnetKind}
            className="px-5 py-2.5 rounded-full text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2 transition-colors duration-200"
          >
            {createMut.isPending && (
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border-2 border-on-primary/30 border-t-on-primary animate-spin"
                aria-hidden
              />
            )}
            Create binding
          </button>
        </div>
      </form>
    </M3Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}
