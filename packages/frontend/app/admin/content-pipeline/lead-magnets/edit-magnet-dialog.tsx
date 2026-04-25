"use client";
import { useEffect, useState } from "react";
import { M3Dialog } from "../components/m3-dialog";
import type { MagnetDefinition, UpdateMagnetPatch } from "../lib/magnet-api";

const AUDIENCES = ["investor", "agent", "broker", "mixed"] as const;

/**
 * M3 dialog for editing the operator-tunable fields of a lead magnet
 * (display name, description, audience, cover image URL). Template
 * paths and data methods are seeded — this dialog doesn't expose them.
 */
export function EditMagnetDialog({
  magnet,
  open,
  onClose,
  onSave,
}: {
  magnet: MagnetDefinition;
  open: boolean;
  onClose: () => void;
  onSave: (patch: UpdateMagnetPatch) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(magnet.display_name);
  const [description, setDescription] = useState(magnet.description ?? "");
  const [audience, setAudience] = useState<UpdateMagnetPatch["audience"]>(
    magnet.audience as UpdateMagnetPatch["audience"],
  );
  const [coverUrl, setCoverUrl] = useState(magnet.cover_image_url ?? "");
  const [busy, setBusy] = useState(false);

  // Reset on open / magnet change so previous edits don't leak.
  useEffect(() => {
    if (open) {
      setDisplayName(magnet.display_name);
      setDescription(magnet.description ?? "");
      setAudience(magnet.audience as UpdateMagnetPatch["audience"]);
      setCoverUrl(magnet.cover_image_url ?? "");
      setBusy(false);
    }
  }, [open, magnet]);

  async function handleSubmit() {
    setBusy(true);
    try {
      await onSave({
        display_name: displayName.trim(),
        description: description.trim(),
        audience,
        cover_image_url: coverUrl.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <M3Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      ariaLabel={`Edit ${magnet.display_name}`}
      maxWidth="max-w-lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-medium text-on-surface">Edit magnet</h2>
          <Field label="Display name">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-surface text-on-surface rounded-lg border border-outline px-3 py-2 text-sm focus:outline-none focus:border-primary"
              required
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-surface text-on-surface rounded-lg border border-outline px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
            />
          </Field>
          <Field label="Audience">
            <div className="flex gap-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudience(a)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-200 ${
                    audience === a
                      ? "bg-secondary-container text-on-secondary-container border-transparent"
                      : "bg-surface text-on-surface border-outline hover:bg-surface-container-low"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Cover image URL (optional)">
            <input
              type="url"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://…"
              className="w-full bg-surface text-on-surface rounded-lg border border-outline px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-5 py-2.5 rounded-full text-sm font-medium text-on-surface hover:bg-on-surface/8 disabled:opacity-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !displayName.trim()}
            className="px-5 py-2.5 rounded-full text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2 transition-colors duration-200"
          >
            {busy && (
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border-2 border-on-primary/30 border-t-on-primary animate-spin"
                aria-hidden
              />
            )}
            Save
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
