"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchStyleReferences,
  createStyleReference,
  reExtractStyleReference,
  deleteStyleReference,
  type StyleReference,
} from "../lib/style-refs-api";
import { useToast } from "../lib/toast";
import { DestructiveDialog } from "../components/destructive-dialog";
import { M3Dialog } from "../components/m3-dialog";

const QUERY_KEY = ["content-pipeline-style-references"] as const;
const KIND_OPTIONS = ["thumbnail", "video", "pdf", "general"] as const;

/**
 * Style Library — operator-curated reference images that drive the
 * Remotion thumbnail variants (Task 2.28). Each reference goes through
 * Vision extraction on create to produce a palette + typography +
 * layout summary the renderer can read.
 */
export default function StyleReferencesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchStyleReferences,
  });
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<StyleReference | null>(null);

  const createMut = useMutation({
    mutationFn: createStyleReference,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Reference added — Vision extraction running");
      setAddOpen(false);
    },
    onError: (err: Error) =>
      toast.error(`Add failed: ${err.message.slice(0, 100)}`),
  });

  const reExtractMut = useMutation({
    mutationFn: reExtractStyleReference,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Re-extracted");
    },
    onError: (err: Error) =>
      toast.error(`Re-extract failed: ${err.message.slice(0, 100)}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteStyleReference(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Reference removed");
    },
    onError: (err: Error) =>
      toast.error(`Delete failed: ${err.message.slice(0, 100)}`),
  });

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">
            Style Library
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Reference images we run through Vision to extract palettes that
            drive the Remotion thumbnail variants. Drop in screenshots from
            channels you want PropertyIQ to look like.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="bg-primary text-on-primary rounded-full px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors duration-200"
        >
          + Add reference
        </button>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-72 bg-surface-container-low rounded-2xl animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState onAdd={() => setAddOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((ref) => (
            <ReferenceCard
              key={ref.id}
              ref_={ref}
              onReExtract={() => reExtractMut.mutate(ref.id)}
              onDelete={() => setDeleting(ref)}
              isReExtracting={
                reExtractMut.isPending && reExtractMut.variables === ref.id
              }
            />
          ))}
        </div>
      )}

      <AddReferenceDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={(body) => createMut.mutateAsync(body)}
        busy={createMut.isPending}
      />
      <DestructiveDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) {
            await deleteMut.mutateAsync(deleting.id);
            setDeleting(null);
          }
        }}
        title={`Delete "${deleting?.label}"?`}
        body={<p>Removes this reference from the library. Cannot be undone.</p>}
        confirmLabel="Delete reference"
      />
    </div>
  );
}

function ReferenceCard({
  ref_,
  onReExtract,
  onDelete,
  isReExtracting,
}: {
  ref_: StyleReference;
  onReExtract: () => void;
  onDelete: () => void;
  isReExtracting: boolean;
}) {
  const palette = ref_.extracted_attributes.palette ?? [];
  return (
    <div className="rounded-2xl bg-surface-container-low overflow-hidden shadow-sm flex flex-col">
      {ref_.source_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ref_.source_url}
          alt={ref_.label}
          className="w-full h-40 object-cover bg-on-surface/10"
        />
      ) : (
        <div className="w-full h-40 bg-surface-container flex items-center justify-center text-on-surface-variant text-xs">
          (no image)
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-on-surface truncate">
            {ref_.label}
          </h3>
          <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">
            {ref_.kind}
          </span>
        </div>

        {palette.length > 0 ? (
          <div className="flex gap-1">
            {palette.slice(0, 6).map((c, i) => (
              <span
                key={i}
                title={c}
                className="block flex-1 h-6 rounded-md border border-outline-variant"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-on-surface-variant italic">
            No palette extracted yet. Try Re-extract.
          </p>
        )}

        {ref_.extracted_attributes.summary && (
          <p className="text-xs text-on-surface-variant line-clamp-3">
            {ref_.extracted_attributes.summary}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-2 text-[11px] text-on-surface-variant">
          <span>
            ${ref_.vision_cost_usd?.toFixed(4) ?? "0"} ·{" "}
            {new Date(ref_.created_at).toLocaleDateString()}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onReExtract}
              disabled={isReExtracting}
              className="text-primary text-xs font-medium hover:bg-primary/8 rounded-full px-2 py-1 disabled:opacity-50 transition-colors duration-200"
            >
              {isReExtracting ? "Extracting…" : "Re-extract"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="text-error text-xs font-medium hover:bg-error/10 rounded-full px-2 py-1 transition-colors duration-200"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl bg-surface-container-low px-8 py-12 text-center">
      <p className="text-sm text-on-surface mb-2">No style references yet.</p>
      <p className="text-xs text-on-surface-variant mb-5 max-w-md mx-auto">
        Add references from channels you want PropertyIQ thumbnails to emulate.
        Each one runs through Vision to extract a palette + style notes the
        renderer can use.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="bg-primary text-on-primary rounded-full px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors duration-200"
      >
        + Add the first reference
      </button>
    </div>
  );
}

function AddReferenceDialog({
  open,
  onClose,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: {
    label: string;
    kind: "thumbnail" | "video" | "pdf" | "general";
    source_url: string;
  }) => Promise<unknown>;
  busy: boolean;
}) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<(typeof KIND_OPTIONS)[number]>("thumbnail");
  const [url, setUrl] = useState("");

  return (
    <M3Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      ariaLabel="Add reference"
      maxWidth="max-w-lg"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!label.trim() || !url.trim()) return;
          await onSubmit({ label: label.trim(), kind, source_url: url.trim() });
          setLabel("");
          setUrl("");
        }}
      >
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-medium text-on-surface">
            Add a reference
          </h2>
          <Field label="Label">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. MrBeast hot palette"
              required
              className="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </Field>
          <Field label="Kind">
            <div className="flex gap-2">
              {KIND_OPTIONS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors duration-200 ${
                    kind === k
                      ? "bg-secondary-container text-on-secondary-container border-transparent"
                      : "bg-surface text-on-surface border-outline hover:bg-surface-container-low"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Image URL">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://… (PNG/JPG)"
              required
              className="w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </Field>
          <p className="text-[11px] text-on-surface-variant">
            Vision extraction runs synchronously on submit (~1 second). The
            extracted palette appears on the card right after.
          </p>
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
            disabled={busy || !label.trim() || !url.trim()}
            className="px-5 py-2.5 rounded-full text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2 transition-colors duration-200"
          >
            {busy && (
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border-2 border-on-primary/30 border-t-on-primary animate-spin"
                aria-hidden
              />
            )}
            Add + extract
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
