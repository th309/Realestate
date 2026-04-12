import { cache } from "react";
import type { Metadata } from "next";
import { ShareRedirectClient } from "./ShareRedirectClient";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://propertyiq.app";

interface SharePageProps {
  params: Promise<{ token: string }>;
}

// cache() deduplicates across generateMetadata + page render in a single request,
// preventing double view-count increments from the access endpoint.
const fetchShareData = cache(async function fetchShareData(token: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/analytics/shares/access/${token}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success) return null;
    return json.data;
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { token } = await params;
  const share = await fetchShareData(token);

  if (!share || share.content_type !== "market_share") {
    return { title: "PropertyIQ" };
  }

  const market = share.content?.market;
  const geoName = market?.geoName || share.title || "Market Report";
  const score = market?.score;

  const descriptionParts = [];
  if (score != null)
    descriptionParts.push(`PropertyIQ Score: ${Math.round(score)}`);
  if (market?.homeValue)
    descriptionParts.push(`Home Value: ${market.homeValue}`);
  if (market?.appreciation)
    descriptionParts.push(`YoY: ${market.appreciation}`);
  if (market?.dom) descriptionParts.push(`DOM: ${market.dom}`);
  if (market?.supply) descriptionParts.push(`Supply: ${market.supply}`);
  const description =
    descriptionParts.join(" · ") || `Market report for ${geoName}`;

  const ogParams = new URLSearchParams({ title: geoName });
  if (score != null) ogParams.set("score", String(Math.round(score)));
  if (market?.homeValue) ogParams.set("homeValue", market.homeValue);
  if (market?.appreciation) ogParams.set("appreciation", market.appreciation);
  if (market?.dom) ogParams.set("dom", market.dom);
  if (market?.supply) ogParams.set("supply", market.supply);

  const ogImageUrl = `${SITE_URL}/api/og?${ogParams.toString()}`;

  return {
    title: `${geoName} Market Report — PropertyIQ`,
    description,
    openGraph: {
      title: `${geoName} Market Report — PropertyIQ`,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${geoName} Market Report — PropertyIQ`,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const share = await fetchShareData(token);

  if (!share) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center max-w-md px-6">
          <div className="w-3 h-3 rounded-full bg-primary mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-on-surface mb-2">
            Link Expired or Not Found
          </h1>
          <p className="text-sm text-on-surface-variant mb-6">
            This share link is no longer available. It may have expired or been
            removed.
          </p>
          <a
            href="/market"
            className="inline-block px-6 py-2.5 rounded-full bg-primary text-on-primary text-sm font-medium"
          >
            Browse Markets
          </a>
        </div>
      </div>
    );
  }

  const market = share.content?.market;
  const redirectUrl = market
    ? `/market/${market.geoId}?type=${market.geoLevel}`
    : "/market";

  return (
    <ShareRedirectClient redirectUrl={redirectUrl} geoName={market?.geoName} />
  );
}
