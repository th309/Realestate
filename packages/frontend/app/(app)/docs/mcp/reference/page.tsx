import type { Metadata } from "next";
import { McpReferenceClient } from "./components/McpReferenceClient";

export const metadata: Metadata = {
  title: "MCP Tools Reference | PropertyIQ",
  description:
    "Full parameter reference, worked examples, and troubleshooting for PropertyIQ's 44 MCP tools.",
};

export default function McpReferencePage() {
  return <McpReferenceClient />;
}
