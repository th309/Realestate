/**
 * Uploading operator-supplied media for a run's named slots.
 *
 * Multipart, not a signed-URL PUT: every other upload in content-pipeline
 * posts through the backend (see the thumbnail-override and style-reference
 * routes), and the server needs the bytes anyway to probe the asset's real
 * dimensions.
 */

export interface RunSlotAsset {
  /** Signed URL for previewing what was uploaded. */
  url: string;
  slotId: string;
  kind: "image" | "video";
  /**
   * width/height of the source, probed server-side.
   *
   * The renderer needs it to place a focus region correctly — a region is
   * authored against the source asset, so mapping it onto a differently
   * shaped frame requires the source's shape. Null when the probe could not
   * read the file, which is not fatal: the slot just renders full-frame.
   */
  sourceAspect: number | null;
  bytes: number;
}

export async function uploadRunSlotAsset(
  runId: string,
  slotId: string,
  file: File,
): Promise<RunSlotAsset> {
  const body = new FormData();
  body.append("file", file);

  const res = await fetch(
    `/api/admin/content-pipeline/runs/${encodeURIComponent(runId)}/slots/${encodeURIComponent(slotId)}`,
    { method: "POST", body },
  );

  if (!res.ok) {
    // Surface the server's own reason — it knows why (wrong signature, over
    // the cap) and a generic failure leaves the operator guessing.
    let detail = `Upload failed (${res.status})`;
    try {
      const payload = (await res.json()) as { message?: string | string[] };
      if (payload?.message) {
        detail = Array.isArray(payload.message)
          ? payload.message.join(", ")
          : payload.message;
      }
    } catch {
      // Non-JSON error body; the status line is all we have.
    }
    throw new Error(detail);
  }

  return (await res.json()) as RunSlotAsset;
}
