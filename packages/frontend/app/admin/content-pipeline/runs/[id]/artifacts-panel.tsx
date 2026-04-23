"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchAssetSignedUrl } from "../../lib/content-pipeline-api";

export function ArtifactsPanel({
  runId,
  assets,
}: {
  runId: string;
  assets: Array<{ kind: string; storage_url: string; metadata: any }>;
}) {
  const script = assets.find((a) => a.kind === "script");
  const audio = assets.find((a) => a.kind === "audio");
  const video = assets.find((a) => a.kind === "video_master");

  return (
    <div className="space-y-6">
      {script && (
        <section>
          <h3 className="font-semibold mb-2">Script</h3>
          <pre className="bg-surface-container-low rounded-xl p-4 text-sm whitespace-pre-wrap">
            {script.metadata?.scripts?.[0]?.fullText ?? "pending..."}
          </pre>
        </section>
      )}
      {audio && (
        <section>
          <h3 className="font-semibold mb-2">Voice</h3>
          <SignedMedia runId={runId} kind="audio" variant="audio" />
        </section>
      )}
      {video && (
        <section>
          <h3 className="font-semibold mb-2">Video</h3>
          <SignedMedia runId={runId} kind="video_master" variant="video" />
        </section>
      )}
    </div>
  );
}

function SignedMedia({
  runId,
  kind,
  variant,
}: {
  runId: string;
  kind: "video_master" | "audio";
  variant: "audio" | "video";
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["content-pipeline-asset-url", runId, kind],
    queryFn: () => fetchAssetSignedUrl(runId, kind),
    staleTime: 50 * 60 * 1000,
  });

  if (isLoading) return <div className="text-sm text-outline">Loading…</div>;
  if (error)
    return <div className="text-sm text-error">Couldn’t load {kind}</div>;
  if (!data?.url)
    return <div className="text-sm text-outline">No {kind} available</div>;

  return variant === "video" ? (
    <video
      controls
      src={data.url}
      className="w-[240px] rounded-xl aspect-[9/16]"
    />
  ) : (
    <audio controls src={data.url} className="w-full" />
  );
}
