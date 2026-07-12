import type { Metadata } from "next";
import { NewsletterSignup } from "@/components/newsletter/NewsletterSignup";

export const metadata: Metadata = {
  title: "PropertyIQ Market Pulse — Weekly Housing Market Newsletter",
  description:
    "Get weekly data-driven housing market analysis delivered to your inbox. PropertyIQ tracks 400+ U.S. markets so you don't have to.",
  alternates: { canonical: "https://www.propertyiq.app/newsletter" },
  openGraph: {
    title: "PropertyIQ Market Pulse",
    description:
      "Weekly housing market analysis for real estate investors, buyers, and agents.",
    url: "https://www.propertyiq.app/newsletter",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export default function NewsletterPage() {
  return (
    <div className="min-h-dvh bg-surface">
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
          Free Weekly Newsletter
        </p>
        <h1 className="text-4xl font-bold text-on-surface mb-4 leading-tight">
          PropertyIQ Market Pulse
        </h1>
        <p className="text-lg text-on-surface-variant mb-10 leading-relaxed">
          Data-driven housing market analysis, every week. PropertyIQ tracks
          400+ U.S. markets — score changes, trends, and emerging opportunities
          — delivered to your inbox, free.
        </p>

        <div className="max-w-md mx-auto">
          <NewsletterSignup
            source="newsletter-page"
            label="Join the Market Pulse"
            description="Weekly insights for real estate investors, buyers, and agents. No spam, unsubscribe anytime."
            buttonText="Subscribe Free"
          />
        </div>

        <div className="mt-12 grid sm:grid-cols-3 gap-6 text-left">
          <div className="bg-surface-container-low rounded-xl p-5">
            <p className="text-sm font-semibold text-on-surface mb-1">
              400+ Markets Tracked
            </p>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Every MSA in the U.S., scored monthly on a 0–100 PropertyIQ index.
            </p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-5">
            <p className="text-sm font-semibold text-on-surface mb-1">
              Real Data Sources
            </p>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Zillow, Census, Realtor.com, FRED economic indicators — not
              opinion.
            </p>
          </div>
          <div className="bg-surface-container-low rounded-xl p-5">
            <p className="text-sm font-semibold text-on-surface mb-1">
              Always Free
            </p>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              The Market Pulse newsletter is free. No credit card required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
