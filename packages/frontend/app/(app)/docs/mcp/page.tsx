import type { Metadata } from "next";
import { McpHero } from "./components/landing/McpHero";
import { InstallSection } from "./components/landing/InstallSection";
import { CapabilitiesSection } from "./components/landing/CapabilitiesSection";
import { McpFaqSection } from "./components/landing/McpFaqSection";
import { ClosingCta } from "./components/landing/ClosingCta";
import { LegacyHashRedirect } from "./components/landing/LegacyHashRedirect";

export const metadata: Metadata = {
  title: "MCP Integration | PropertyIQ",
  description:
    "Connect PropertyIQ to your AI assistant — Claude, Cursor, VS Code, and more. 44 real estate analysis tools via the Model Context Protocol.",
};

export default function McpDocsPage() {
  return (
    <div className="min-h-screen bg-surface">
      <LegacyHashRedirect />
      <McpHero />
      <InstallSection />
      <CapabilitiesSection />
      <McpFaqSection />
      <ClosingCta />
    </div>
  );
}
