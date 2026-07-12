import type { Metadata } from "next";
import { Scale } from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { TermsSidebar } from "./TermsSidebar";
import { IntroSections } from "./TermsSectionsIntro";
import { RightsSections } from "./TermsSectionsRights";
import { BillingSections } from "./TermsSectionsBilling";
import { LegalSections } from "./TermsSectionsLegal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read PropertyIQ's Terms of Service covering data usage, intellectual property, user responsibilities, billing, and legal disclaimers.",
  alternates: { canonical: "https://www.propertyiq.app/about/terms" },
  openGraph: {
    title: "Terms of Service | PropertyIQ",
    description:
      "Read PropertyIQ's Terms of Service covering data usage, intellectual property, user responsibilities, billing, and legal disclaimers.",
    url: "https://www.propertyiq.app/about/terms",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-dvh bg-surface">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[
            { label: "About", href: "/about" },
            { label: "Terms of Service" },
          ]}
          title="Terms of Service"
          description="PropertyIQ — Operated by Federal Contracting Services LLC"
          icon={<Scale className="w-5 h-5" />}
        />

        <div className="mt-4 mb-10">
          <span className="inline-block text-xs font-semibold text-primary bg-primary/10 px-3.5 py-1.5 rounded-full">
            Effective Date: February 24, 2026
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12">
          <TermsSidebar />

          <main>
            <IntroSections />
            <RightsSections />
            <BillingSections />
            <LegalSections />

            <div className="mt-12 pt-8 border-t border-outline-variant">
              <p className="text-center text-sm text-on-surface-variant">
                By using PropertyIQ, you acknowledge that you have read,
                understood, and agree to be bound by these Terms of Service.
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
