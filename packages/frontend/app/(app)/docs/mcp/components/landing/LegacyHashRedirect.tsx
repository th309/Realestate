"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MCP_TABS } from "../mcp-docs-data";

/**
 * The old tabbed page served deep content at /docs/mcp#tools etc.
 * Anyone with that link (or a saved bookmark) lands here now, so bounce
 * them to the equivalent hash on the new reference page. #setup stayed on
 * this page (it's now the #install section), so just scroll to it.
 */
export function LegacyHashRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "setup") {
      document.getElementById("install")?.scrollIntoView();
      return;
    }
    const isLegacyReferenceTab = MCP_TABS.some((tab) => tab.id === hash);
    if (isLegacyReferenceTab) router.replace(`/docs/mcp/reference#${hash}`);
  }, [router]);

  return null;
}
