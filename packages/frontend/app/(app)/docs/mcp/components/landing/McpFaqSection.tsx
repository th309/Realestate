import { FaqSection } from "@/app/components/seo/FaqSection";
import { MCP_FAQ } from "../mcp-docs-data";

export function McpFaqSection() {
  return <FaqSection faqs={MCP_FAQ} heading="Questions, answered" />;
}
