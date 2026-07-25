import type { ReactElement } from "react";
import type { SocialConnectPlatform } from "@/lib/data";

/**
 * Presentational metadata for the five Late-managed networks. Glyphs are
 * monochrome (currentColor) so they inherit M3 text tokens — no hardcoded
 * brand hex (CLAUDE.md §8.2). YouTube is intentionally absent: it keeps its
 * own direct OAuth card in the "Direct integration" section.
 */
export interface SocialPlatformMeta {
  id: SocialConnectPlatform;
  label: string;
  Glyph: (props: { className?: string }) => ReactElement;
}

const Instagram = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden
  >
    <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 3.24A6.6 6.6 0 1 0 18.6 12 6.6 6.6 0 0 0 12 5.4zm0 10.89A4.29 4.29 0 1 1 16.29 12 4.29 4.29 0 0 1 12 16.29zm6.85-11.15a1.54 1.54 0 1 0 1.54 1.54 1.54 1.54 0 0 0-1.54-1.54z" />
  </svg>
);

const Facebook = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden
  >
    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
  </svg>
);

const TikTok = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden
  >
    <path d="M16.6 5.82a4.28 4.28 0 0 1-1.06-2.82h-3.2v12.63a2.59 2.59 0 1 1-2.59-2.59c.27 0 .53.04.78.12v-3.3a5.87 5.87 0 0 0-.78-.05 5.9 5.9 0 1 0 5.9 5.9V9.4a7.48 7.48 0 0 0 4.35 1.39V7.6a4.29 4.29 0 0 1-3.4-1.78z" />
  </svg>
);

const LinkedIn = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden
  >
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05a3.75 3.75 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
  </svg>
);

const X = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden
  >
    <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.22-6.82-5.96 6.82H1.66l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.01 4.13H5.05l12.03 15.64z" />
  </svg>
);

export const SOCIAL_PLATFORM_META: SocialPlatformMeta[] = [
  { id: "instagram", label: "Instagram", Glyph: Instagram },
  { id: "facebook", label: "Facebook", Glyph: Facebook },
  { id: "tiktok", label: "TikTok", Glyph: TikTok },
  { id: "linkedin", label: "LinkedIn", Glyph: LinkedIn },
  { id: "x", label: "X", Glyph: X },
];
