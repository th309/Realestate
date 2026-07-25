/**
 * Compact platform badge for planner post cards. A short monospaced code in a
 * tinted chip — legible at card size and dependency-free (no icon fonts).
 * Unknown platforms fall back to their first two letters.
 */

const PLATFORM_SHORT: Record<string, { short: string; label: string }> = {
  instagram: { short: "IG", label: "Instagram" },
  tiktok: { short: "TT", label: "TikTok" },
  youtube: { short: "YT", label: "YouTube" },
  youtube_shorts: { short: "YT", label: "YouTube Shorts" },
  shorts: { short: "YT", label: "YouTube Shorts" },
  x: { short: "X", label: "X" },
  twitter: { short: "X", label: "X" },
  linkedin: { short: "IN", label: "LinkedIn" },
  facebook: { short: "FB", label: "Facebook" },
  threads: { short: "TH", label: "Threads" },
  reddit: { short: "RD", label: "Reddit" },
};

export function PlatformGlyph({
  platform,
  className = "",
}: {
  platform: string;
  className?: string;
}) {
  const key = (platform ?? "").toLowerCase();
  const meta = PLATFORM_SHORT[key] ?? {
    short: (platform ?? "?").slice(0, 2).toUpperCase(),
    label: platform || "Platform",
  };
  return (
    <span
      title={meta.label}
      aria-label={meta.label}
      className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded bg-surface-container-high px-1 font-mono text-[10px] font-semibold text-on-surface-variant ${className}`}
    >
      {meta.short}
    </span>
  );
}
