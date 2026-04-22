export function ArtifactsPanel({
  assets,
}: {
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
          <audio
            controls
            src={publicUrl(audio.storage_url)}
            className="w-full"
          />
        </section>
      )}
      {video && (
        <section>
          <h3 className="font-semibold mb-2">Video</h3>
          <video
            controls
            src={publicUrl(video.storage_url)}
            className="w-full rounded-xl aspect-[9/16] max-w-md"
          />
        </section>
      )}
    </div>
  );
}

function publicUrl(storageUrl: string): string {
  const match = storageUrl.match(/^supabase:\/\/([^/]+)\/(.+)$/);
  if (!match) return storageUrl;
  const [, bucket, path] = match;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
