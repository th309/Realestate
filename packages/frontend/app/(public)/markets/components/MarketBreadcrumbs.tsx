import Link from "next/link";
import type { AncestorChain } from "@/lib/data/market-hierarchy";

const BASE_URL = "https://www.propertyiq.app";

interface Crumb {
  name: string;
  href: string;
}

function buildCrumbs(
  chain: AncestorChain,
  currentName: string,
  currentHref: string,
): Crumb[] {
  const crumbs: Crumb[] = [
    { name: "Home", href: "/" },
    { name: "Markets", href: "/markets" },
  ];
  if (chain.state) {
    crumbs.push({
      name: chain.state.name,
      href: `/markets/state/${chain.state.slug}`,
    });
  }
  if (chain.metro) {
    crumbs.push({
      name: chain.metro.shortName,
      href: `/markets/${chain.metro.slug}`,
    });
  }
  if (chain.county) {
    crumbs.push({
      name: chain.county.shortName,
      href: `/markets/county/${chain.county.slug}`,
    });
  }
  crumbs.push({ name: currentName, href: currentHref });
  return crumbs;
}

export interface MarketBreadcrumbsProps {
  chain: AncestorChain;
  currentName: string;
  currentHref: string;
}

/**
 * Full ancestor-chain breadcrumb (Home / Markets / State / Metro / County / current),
 * skipping any tier absent from `chain`. Renders the visible nav AND the matching
 * BreadcrumbList JSON-LD from the same crumb list, so they cannot drift apart.
 */
export function MarketBreadcrumbs({
  chain,
  currentName,
  currentHref,
}: MarketBreadcrumbsProps) {
  const crumbs = buildCrumbs(chain, currentName, currentHref);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${BASE_URL}${crumb.href}`,
    })),
  };

  return (
    <>
      <nav
        className="text-sm text-on-surface-variant mb-6"
        aria-label="Breadcrumb"
      >
        {crumbs.map((crumb, index) => (
          <span key={crumb.href}>
            {index > 0 && <span className="mx-2">/</span>}
            {index === crumbs.length - 1 ? (
              <span className="text-on-surface font-medium">{crumb.name}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-primary">
                {crumb.name}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <script
        type="application/ld+json"
        // Safe: JSON.stringify of a server-built object with no user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
