interface WebPageJsonLdProps {
  url: string;
  name: string;
  description: string;
  dateModified?: string;
  breadcrumbs?: { name: string; url: string }[];
}

export function WebPageJsonLd({
  url,
  name,
  description,
  dateModified,
  breadcrumbs,
}: WebPageJsonLdProps) {
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name,
      description,
      isPartOf: { "@id": "https://www.propertyiq.app/#website" },
      ...(dateModified && { dateModified }),
    },
  ];

  if (breadcrumbs) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        item: item.url,
      })),
    });
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": graph,
        }),
      }}
    />
  );
}
