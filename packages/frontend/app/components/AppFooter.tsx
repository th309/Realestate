"use client";

import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/data", label: "Data Sources" },
  { href: "/scores/methodology", label: "Methodology" },
  { href: "/scores/accuracy", label: "Accuracy" },
  { href: "/compare/propertyiq-vs-mashvisor", label: "vs Mashvisor" },
  {
    href: "/compare/propertyiq-vs-neighborhoodscout",
    label: "vs NeighborhoodScout",
  },
  { href: "/compare/propertyiq-vs-reventure", label: "vs Reventure" },
  { href: "/contact", label: "Contact" },
  { href: "/about/terms", label: "Terms" },
];

/** Compact footer on /map routes (disclaimer only), full footer elsewhere. */
export function AppFooter() {
  const pathname = usePathname();
  const isMapPage = pathname === "/map" || pathname.startsWith("/map/");

  if (isMapPage) {
    return (
      <footer className="flex-shrink-0 bg-surface-container border-t border-outline-variant py-2 px-4">
        <p className="text-center text-[10px] text-on-surface-variant">
          Data is provided for informational purposes only. We do not guarantee
          completeness or correctness and accept no liability for its use.
        </p>
      </footer>
    );
  }

  return (
    <footer className="flex-shrink-0 bg-surface-container border-t border-outline-variant py-6 px-4 pb-12">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4 text-xs text-on-surface-variant">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-on-surface transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
        <p className="text-center text-xs text-on-surface-variant">
          Data is provided for informational purposes only. While we strive for
          accuracy, we do not guarantee the completeness or correctness of the
          information and accept no liability for its use.
        </p>
      </div>
    </footer>
  );
}
