/**
 * Re-export shim — split into components/ui/skeleton/* (CLAUDE.md §1.3: 2+
 * exports = must split). Keeps every existing `from "@/components/ui/Skeleton"`
 * import path working unchanged.
 *
 * New code should import from "@/components/ui/skeleton/index" (or a specific
 * file inside that directory) — NOT the bare "@/components/ui/skeleton" — on
 * case-insensitive filesystems (Windows/default macOS) TypeScript's file-then-
 * directory module resolution treats bare "skeleton" as a case-only variant of
 * this "Skeleton.tsx" file and errors (TS1149) rather than resolving to the
 * directory's barrel.
 */
export * from "./skeleton/index";
