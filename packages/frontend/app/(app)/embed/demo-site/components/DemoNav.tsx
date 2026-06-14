"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const NAV_LINKS = [
  { label: "Home", href: "/embed/demo-site" },
  { label: "Market Data", href: "/embed/demo-site/market-data" },
  { label: "Market Report", href: "/embed/demo-site/report" },
];

/**
 * Fake brokerage navigation bar for the demo site.
 *
 * Sticky top bar with "Acme Real Estate Group" branding and page links.
 * Preserves the ?token= query param across navigation so embedded
 * PropertyIQ widgets continue to authenticate.
 */
export function DemoNav() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token");
  const querySuffix = tokenParam ? `?token=${tokenParam}` : "";

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        height: 64,
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <Link
        href={`/embed/demo-site${querySuffix}`}
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 22,
          fontWeight: 700,
          color: "#1e3a5f",
          textDecoration: "none",
        }}
      >
        Acme Real Estate Group
      </Link>

      <div style={{ display: "flex", gap: 28 }}>
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={`${link.href}${querySuffix}`}
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: 15,
              fontWeight: 500,
              color: "#1e3a5f",
              textDecoration: "none",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.opacity = "0.7";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.opacity = "1";
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
