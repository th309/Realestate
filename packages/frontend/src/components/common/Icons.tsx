/**
 * Icons barrel — re-exports all icons from split files.
 *
 * Split per CLAUDE.md §1.3 (file-size compliance):
 *   Icons.nav.tsx     — navigation chrome & action icons (Header, MobileMenu)
 *   Icons.feature.tsx — feature/content icons (nav dropdowns, page sections)
 *
 * All existing import paths (`@/src/components/common/Icons`) remain unchanged.
 */

export * from "./Icons.nav";
export * from "./Icons.feature";
