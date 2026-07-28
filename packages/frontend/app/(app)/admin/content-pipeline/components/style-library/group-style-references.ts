import type { StyleReference } from "../../lib/style-refs-api";

export interface StyleReferenceGroup {
  /** Derived style name, e.g. "Doom-Data Alarm" (first-seen casing). */
  name: string;
  references: StyleReference[];
}

/**
 * Derive the taxonomy style name from a reference label. Labels follow
 * "<Style Name> (<description>)" for images and
 * "<Style Name> sample video (<description>)" for videos, so stripping the
 * trailing "sample video" marker and the parenthetical yields the shared
 * group key. The marker is only stripped as a suffix (with its optional
 * parenthetical) so a style genuinely NAMED "Sample Video Wall" survives.
 * Labels that degenerate to nothing group under "Untitled".
 */
export function styleGroupName(label: string): string {
  const stripped = label
    .replace(/\s+sample video\s*(\(.*)?$/i, "")
    .replace(/\s*\(.*$/, "")
    .trim();
  return stripped || label.trim() || "Untitled";
}

/**
 * Group references by derived style name (case-insensitive key, first-seen
 * casing shown), alphabetical by group; within a group the image
 * (thumbnail/pdf/general) references come before videos so each section
 * reads "the look, then the motion", newest first within the same kind to
 * match the old flat grid's recency ordering.
 */
export function groupStyleReferences(
  references: StyleReference[],
): StyleReferenceGroup[] {
  // Display casing comes from an image reference when the group has one —
  // image labels carry the canonical style name; API order (newest-first)
  // would otherwise make the shown casing depend on insertion order.
  const byKey = new Map<
    string,
    { name: string; nameFromImage: boolean; refs: StyleReference[] }
  >();
  for (const ref of references) {
    const name = styleGroupName(ref.label);
    const key = name.toLowerCase();
    const isImage = ref.kind !== "video";
    const bucket = byKey.get(key);
    if (bucket) {
      bucket.refs.push(ref);
      if (isImage && !bucket.nameFromImage) {
        bucket.name = name;
        bucket.nameFromImage = true;
      }
    } else {
      byKey.set(key, { name, nameFromImage: isImage, refs: [ref] });
    }
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, { name, refs }]) => ({
      name,
      references: [...refs].sort((a, b) => {
        const aVideo = a.kind === "video" ? 1 : 0;
        const bVideo = b.kind === "video" ? 1 : 0;
        if (aVideo !== bVideo) return aVideo - bVideo;
        return b.created_at.localeCompare(a.created_at);
      }),
    }));
}
