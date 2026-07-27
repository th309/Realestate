"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchStyleReferences,
  createStyleReference,
  ingestVideoUrl,
  uploadVideoReference,
  reExtractStyleReference,
  deleteStyleReference,
  type StyleReference,
} from "../lib/style-refs-api";
import {
  fetchStylePreferences,
  saveStylePreference,
  setStyleSignalWeight,
  unsaveStylePreference,
} from "../lib/style-preferences-api";
import { useToast } from "../lib/toast";
import { DestructiveDialog } from "../components/destructive-dialog";
import { ReferenceCard } from "../components/style-library/ReferenceCard";
import { AddReferenceDialog } from "../components/style-library/AddReferenceDialog";
import { StyleSignalPanel } from "../components/style-library/StyleSignalPanel";

const QUERY_KEY = ["content-pipeline-style-references"] as const;
const PREFERENCES_KEY = ["content-pipeline-style-preferences"] as const;

/**
 * Style Library — operator-curated reference images that drive the Remotion
 * thumbnail variants, and (once saved) the look the post generator is told to
 * write for. Each reference goes through Vision extraction on create to produce
 * a palette + typography + layout summary.
 */
export default function StyleReferencesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchStyleReferences,
  });
  const { data: preferences } = useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: fetchStylePreferences,
  });
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<StyleReference | null>(null);

  const savedIds = new Set(
    (preferences?.savedStyleRefs ?? []).map((r) => r.style_reference_id),
  );

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

  const ingestVideoUrlMut = useMutation({
    mutationFn: ingestVideoUrl,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Video reference added — analysis running");
      setAddOpen(false);
    },
    onError: (err: Error) =>
      toast.error(`Video ingest failed: ${err.message.slice(0, 120)}`),
  });

  const uploadVideoMut = useMutation({
    mutationFn: uploadVideoReference,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Video uploaded — analysis running");
      setAddOpen(false);
    },
    onError: (err: Error) =>
      toast.error(`Upload failed: ${err.message.slice(0, 120)}`),
  });

  const reExtractMut = useMutation({
    mutationFn: reExtractStyleReference,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      // Re-extraction changes the attributes a saved style contributes to the
      // prompt, so the panel must re-read rather than show the old block.
      qc.invalidateQueries({ queryKey: PREFERENCES_KEY });
      toast.success("Re-extracted");
    },
    onError: (err: Error) =>
      toast.error(`Re-extract failed: ${err.message.slice(0, 100)}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteStyleReference(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: PREFERENCES_KEY });
      toast.success("Reference removed");
    },
    onError: (err: Error) =>
      toast.error(`Delete failed: ${err.message.slice(0, 100)}`),
  });

  const toggleSavedMut = useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) =>
      saved ? unsaveStylePreference(id) : saveStylePreference(id),
    onSuccess: (data, { saved }) => {
      qc.setQueryData(PREFERENCES_KEY, data);
      toast.success(
        saved ? "Stopped using this style" : "Now using this style",
      );
    },
    onError: (err: Error) =>
      toast.error(`Could not update: ${err.message.slice(0, 100)}`),
  });

  const strengthMut = useMutation({
    mutationFn: setStyleSignalWeight,
    onSuccess: (data) => qc.setQueryData(PREFERENCES_KEY, data),
    onError: (err: Error) =>
      toast.error(`Could not update strength: ${err.message.slice(0, 100)}`),
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
            channels you want PropertyIQ to look like, then save the ones the
            post generator should write for.
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

      <StyleSignalPanel
        preferences={preferences}
        onChangeStrength={(weight) => strengthMut.mutate(weight)}
        busy={strengthMut.isPending}
      />

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
              reference={ref}
              isSaved={savedIds.has(ref.id)}
              onToggleSaved={() =>
                toggleSavedMut.mutate({
                  id: ref.id,
                  saved: savedIds.has(ref.id),
                })
              }
              onReExtract={() => reExtractMut.mutate(ref.id)}
              onDelete={() => setDeleting(ref)}
              isSaving={
                toggleSavedMut.isPending &&
                toggleSavedMut.variables?.id === ref.id
              }
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
        onIngestVideoUrl={(body) => ingestVideoUrlMut.mutateAsync(body)}
        onUploadVideo={(body) => uploadVideoMut.mutateAsync(body)}
        busy={
          createMut.isPending ||
          ingestVideoUrlMut.isPending ||
          uploadVideoMut.isPending
        }
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
