import type { ToolCategory } from "./mcp-docs-data";
import { CORE_TOOLS } from "./tools-core";
import { AGENT_TOOLS } from "./tools-agents";
import { CONTENT_TOOLS } from "./tools-content";
import { BROKERAGE_TOOLS } from "./tools-brokerage";
import { PROPERTY_MANAGER_TOOLS } from "./tools-property-managers";
import { INVESTOR_TOOLS } from "./tools-investors";

export const TOOL_CATEGORIES: ToolCategory[] = [
  CORE_TOOLS,
  AGENT_TOOLS,
  CONTENT_TOOLS,
  BROKERAGE_TOOLS,
  PROPERTY_MANAGER_TOOLS,
  INVESTOR_TOOLS,
];
