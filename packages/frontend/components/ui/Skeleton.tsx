/**
 * Re-export shim — split into components/ui/skeleton-parts/* (CLAUDE.md §1.3:
 * 2+ exports = must split). Keeps every existing
 * `from "@/components/ui/Skeleton"` import path working unchanged.
 *
 * Directory is named "skeleton-parts", not "skeleton" — on case-insensitive
 * filesystems (Windows/default macOS) a directory named "skeleton" sitting
 * next to this "Skeleton.tsx" file is a case-only variant of it, which trips
 * TypeScript's forceConsistentCasingInFileNames (TS1149) for any import that
 * resolves the directory by its bare name. "skeleton-parts" can't collide.
 *
 * New code should import from "@/components/ui/skeleton-parts" directly.
 */
export * from "./skeleton-parts";
