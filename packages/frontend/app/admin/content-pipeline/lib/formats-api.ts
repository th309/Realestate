import { fetchAPI } from "@/lib/data/fetchers/base";

export interface FormatSampleVideo {
  runId: string;
  marketName: string;
  /** Signed URL to the run's video_master, or null if it has expired. */
  videoUrl: string | null;
}

/**
 * Per-format sample videos — the most recent successful run's video for
 * each format. Used by the /new format picker so previews always reflect
 * the current Remotion template instead of the stale MP4s baked into
 * /public/format-previews/ at P1 time.
 *
 * Returns an empty record when no runs have produced video yet; caller
 * falls back to the static preview file.
 */
export async function fetchFormatSampleVideos(): Promise<
  Record<string, FormatSampleVideo>
> {
  const res = await fetchAPI<{
    data: { samples: Record<string, FormatSampleVideo> };
  }>("/api/admin/content-pipeline/formats/sample-videos");
  return res.data.samples;
}
