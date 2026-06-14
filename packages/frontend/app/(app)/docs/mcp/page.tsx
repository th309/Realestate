import type { Metadata } from "next";
import { McpDocsPageClient } from "./components/McpDocsPageClient";

export const metadata: Metadata = {
  title: "MCP Integration | PropertyIQ",
  description:
    "Connect PropertyIQ to your AI assistant — Claude, Cursor, VS Code, and more. 44 real estate analysis tools via the Model Context Protocol.",
};

export default function McpDocsPage() {
  return <McpDocsPageClient />;
}
