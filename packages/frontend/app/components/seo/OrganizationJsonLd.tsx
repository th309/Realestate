/**
 * Sitewide Organization entity (E-E-A-T / H5).
 *
 * Rendered on every page via AppShell so the publisher entity is present beyond
 * the homepage — market pages, methodology, blog, etc. Uses the canonical
 * `@id` that other schemas (WebSite/WebPage/Dataset/Article `publisher`)
 * reference by id, so those references resolve on any page.
 */
import { safeJsonLdString } from "@/lib/seo/safe-json-ld";

export function OrganizationJsonLd() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://www.propertyiq.app/#organization",
    name: "PropertyIQ",
    url: "https://www.propertyiq.app",
    logo: {
      "@type": "ImageObject",
      url: "https://www.propertyiq.app/logo.png",
      width: 512,
      height: 512,
    },
    description:
      "PropertyIQ provides AI-powered real estate market intelligence for homebuyers, renters, investors, and real estate professionals.",
    foundingDate: "2024",
    // Only profiles PropertyIQ actually controls. NOTE: linkedin.com/company/
    // property-iq (no "-app") belongs to an unrelated Las Vegas company
    // (propertyiq.com) — linking it feeds AI entity confusion.
    sameAs: [
      "https://www.wikidata.org/wiki/Q140473066",
      "https://www.linkedin.com/company/propertyiq-app/",
      "https://www.youtube.com/@PropertyIQ_app",
      "https://www.facebook.com/propertyiq.us",
      "https://www.reddit.com/user/propertyiq-app/",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@propertyiq.app",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdString(organization) }}
    />
  );
}
