"use client";
import { useQuery } from "@tanstack/react-query";
import {
  fetchStyleReferences,
  type StyleReference,
} from "../lib/style-refs-api";

/**
 * Optional render style for video formats, sourced from the Style Library.
 * Owns its own query so formats that produce no video never fetch it.
 */
export function VideoStyleReferenceField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (styleReferenceId: string | undefined) => void;
}) {
  const { data: styleRefs = [] } = useQuery({
    queryKey: ["content-pipeline-style-references"],
    queryFn: fetchStyleReferences,
  });

  const videoRefs = (styleRefs as StyleReference[]).filter(
    (r) => r.kind === "video",
  );

  return (
    <fieldset className="mt-6">
      <legend className="text-xs text-outline mb-2 uppercase tracking-wide">
        Video style reference
      </legend>
      <p className="text-[11px] text-on-surface-variant mb-2">
        Optional. Uses Style Library (kind=video) to pick a render{" "}
        <span className="font-mono">styleVariant</span>.
      </p>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
      >
        <option value="">None (default)</option>
        {videoRefs.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      {videoRefs.length === 0 && (
        <p className="text-[11px] text-on-surface-variant mt-2">
          No video references yet. Add one on{" "}
          <a
            href="/admin/content-pipeline/style-references"
            className="text-primary underline"
          >
            Style Library
          </a>
          .
        </p>
      )}
    </fieldset>
  );
}
