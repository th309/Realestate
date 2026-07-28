"use client";

import { useCallback, useState } from "react";
import {
  FORMAT_MANIFEST,
  type MediaSlotDeclaration,
} from "@propertyiq/video-template/formats";
import { AssetDropzone } from "@/components/media/AssetDropzone";
import { uploadRunSlotAsset, type RunSlotAsset } from "../lib/run-slots-api";

/** Server-side caps, mirrored so a doomed upload is rejected before it starts. */
const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
const VIDEO_MAX_BYTES = 200 * 1024 * 1024;

export interface MediaStepProps {
  format: string;
  /** The draft run these assets attach to. */
  runId: string;
  slots: Record<string, RunSlotAsset>;
  onSlotsChange: (next: Record<string, RunSlotAsset>) => void;
  onBack: () => void;
  onNext: () => void;
}

/**
 * Fills the format's declared media slots.
 *
 * Which slots exist, whether they are required, and what to tell the
 * operator about each all come from the format manifest — the same
 * declaration the renderer reads — so a template that adds a slot gets a
 * dropzone here without this component changing.
 */
export function MediaStep({
  format,
  runId,
  slots,
  onSlotsChange,
  onBack,
  onNext,
}: MediaStepProps) {
  const manifest = FORMAT_MANIFEST[format as keyof typeof FORMAT_MANIFEST];
  const declarations: MediaSlotDeclaration[] = manifest?.mediaSlots ?? [];
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  const upload = useCallback(
    async (slot: MediaSlotDeclaration, file: File) => {
      setUploadingSlot(slot.slotId);
      try {
        const asset = await uploadRunSlotAsset(runId, slot.slotId, file);
        onSlotsChange({ ...slots, [slot.slotId]: asset });
      } finally {
        setUploadingSlot(null);
      }
    },
    [runId, slots, onSlotsChange],
  );

  const clear = useCallback(
    (slotId: string) => {
      const next = { ...slots };
      delete next[slotId];
      onSlotsChange(next);
    },
    [slots, onSlotsChange],
  );

  // Only required slots gate the step; optional ones are genuinely optional.
  const missing = declarations
    .filter((d) => d.required && !slots[d.slotId])
    .map((d) => d.label);

  if (declarations.length === 0) {
    // A format with no slots should never have routed here, but a dead end
    // is worse than a way forward.
    return (
      <div className="p-8">
        <p className="text-on-surface-variant">
          This format doesn&apos;t use any media.
        </p>
        <StepNav onBack={onBack} onNext={onNext} nextDisabled={false} />
      </div>
    );
  }

  return (
    <div className="p-8">
      <h2 className="text-xl font-semibold text-on-surface">
        Add your screens
      </h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        These are the images and clips the video shows. Anything you leave empty
        is skipped.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {declarations.map((slot) => (
          <AssetDropzone
            key={slot.slotId}
            kind={slot.kind}
            label={slot.label}
            helpText={slot.helpText}
            required={slot.required}
            maxBytes={slot.kind === "video" ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES}
            currentUrl={slots[slot.slotId]?.url ?? null}
            uploading={uploadingSlot === slot.slotId}
            disabled={uploadingSlot !== null && uploadingSlot !== slot.slotId}
            onUpload={(file) => upload(slot, file)}
            onClear={() => clear(slot.slotId)}
          />
        ))}
      </div>

      {missing.length > 0 && (
        <p className="mt-6 text-sm text-on-surface-variant">
          Still needed: {missing.join(", ")}
        </p>
      )}

      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextDisabled={missing.length > 0 || uploadingSlot !== null}
      />
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled: boolean;
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
        disabled={nextDisabled}
        className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-on-primary disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}
