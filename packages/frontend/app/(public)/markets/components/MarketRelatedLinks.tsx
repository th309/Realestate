import Link from "next/link";

export interface RelatedLink {
  key: string;
  label: string;
  href: string;
}

export interface RelatedLinkGroup {
  label: string;
  links: RelatedLink[];
  viewAllHref?: string;
  viewAllCount?: number;
}

/**
 * Caps `items` to `cap` and sets `viewAllHref`/`viewAllCount` only when there are
 * more items than fit — the "view all" link is omitted entirely when the capped
 * list already shows everything (an overflow page identical to the inline list
 * would be redundant).
 */
export function buildLinkGroup(
  label: string,
  items: RelatedLink[],
  cap: number,
  viewAllHref: string,
): RelatedLinkGroup {
  const shown = items.slice(0, cap);
  const remaining = items.length - shown.length;
  return {
    label,
    links: shown,
    viewAllHref: remaining > 0 ? viewAllHref : undefined,
    viewAllCount: remaining > 0 ? items.length : undefined,
  };
}

export interface MarketRelatedLinksProps {
  groups: RelatedLinkGroup[];
}

/** Renders each non-empty link group (down-tier children, same-tier nearby markets) as a pill list, with an optional "View all N" link. */
export function MarketRelatedLinks({ groups }: MarketRelatedLinksProps) {
  const visible = groups.filter((group) => group.links.length > 0);
  if (visible.length === 0) return null;

  return (
    <div className="mt-8 space-y-8">
      {visible.map((group) => (
        <div key={group.label}>
          <h3 className="text-base font-medium text-on-surface mb-3">
            {group.label}
          </h3>
          <div className="flex flex-wrap gap-2">
            {group.links.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className="px-4 py-2 rounded-full bg-surface-container-low text-on-surface text-sm hover:bg-surface-container-high transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
          {group.viewAllHref && group.viewAllCount !== undefined && (
            <Link
              href={group.viewAllHref}
              className="inline-block mt-2 text-sm text-on-surface-variant hover:text-primary underline underline-offset-4"
            >
              View all {group.viewAllCount} →
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
