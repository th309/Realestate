import type { Metadata } from "next";
import { DocsPageClient } from "./components/DocsPageClient";

export const metadata: Metadata = {
  title: "API Documentation | PropertyIQ",
  description:
    "PropertyIQ Platform API documentation — getting started, use cases, endpoint reference, and troubleshooting.",
};

export default function ApiDocsPage() {
  return <DocsPageClient />;
}
