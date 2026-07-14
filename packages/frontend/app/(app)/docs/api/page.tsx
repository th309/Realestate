import type { Metadata } from "next";
import { DocsPageClient } from "./components/DocsPageClient";
import { FaqSection } from "@/app/components/seo/FaqSection";
import { DOCS_API_FAQS } from "./docs-api-faqs";

export const metadata: Metadata = {
  title: "API Documentation | PropertyIQ",
  description:
    "PropertyIQ Platform API documentation — getting started, use cases, endpoint reference, and troubleshooting.",
};

export default function ApiDocsPage() {
  return (
    <>
      <DocsPageClient />
      <FaqSection faqs={DOCS_API_FAQS} />
    </>
  );
}
