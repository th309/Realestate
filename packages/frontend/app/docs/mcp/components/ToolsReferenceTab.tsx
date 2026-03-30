"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TOOL_CATEGORIES } from "./mcp-tools-data";
import type { McpTool } from "./mcp-docs-data";

const TOTAL_TOOLS = 44;

/* ─── ToolCard ─── */

function ToolCard({ tool }: { tool: McpTool }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-outline-variant/50 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-container-low transition-colors duration-200"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-on-surface-variant" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-on-surface-variant" />
        )}
        <span className="font-mono text-sm text-primary font-medium">
          {tool.name}
        </span>
        <span className="text-sm text-on-surface-variant truncate">
          {tool.description}
        </span>
      </button>

      {open && (
        <div className="border-t border-outline-variant/50 px-4 py-3 bg-surface-container-low">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th className="pb-2 pr-3 font-medium">Parameter</th>
                <th className="pb-2 pr-3 font-medium">Type</th>
                <th className="pb-2 pr-3 font-medium">Required</th>
                <th className="pb-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {tool.parameters.map((p) => (
                <tr key={p.name} className="border-t border-outline-variant/30">
                  <td className="py-1.5 pr-3">
                    <code className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded">
                      {p.name}
                    </code>
                  </td>
                  <td className="py-1.5 pr-3 text-on-surface-variant">
                    {p.type}
                  </td>
                  <td className="py-1.5 pr-3">
                    {p.required ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                        <span className="size-1.5 rounded-full bg-green-500" />
                        yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">
                        <span className="size-1.5 rounded-full bg-gray-400" />
                        no
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-on-surface-variant">
                    {p.description}
                    {p.default && (
                      <span className="ml-1 text-xs text-on-surface-variant/70">
                        (default:{" "}
                        <code className="font-mono text-xs bg-surface-container px-1 py-0.5 rounded">
                          {p.default}
                        </code>
                        )
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── ToolsReferenceTab ─── */

export function ToolsReferenceTab() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const visibleCategories = activeCategory
    ? TOOL_CATEGORIES.filter((c) => c.id === activeCategory)
    : TOOL_CATEGORIES;

  const visibleToolCount = visibleCategories.reduce(
    (sum, c) => sum + c.toolCount,
    0,
  );

  return (
    <div className="space-y-6">
      {/* How it works callout */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
        <p className="text-sm font-medium text-on-surface">
          You just talk naturally — the AI handles the rest.
        </p>
        <p className="text-sm text-on-surface-variant">
          Many tools below require a{" "}
          <code className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded">
            geo_id
          </code>{" "}
          or{" "}
          <code className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded">
            location_id
          </code>
          . You never need to know these. Just say a market name or ZIP code
          (e.g., &quot;Nashville&quot; or &quot;90210&quot;) and your AI
          assistant will automatically call{" "}
          <code className="font-mono text-xs bg-surface-container px-1.5 py-0.5 rounded">
            search_markets
          </code>{" "}
          first to resolve the ID, then pass it to the right tool.
        </p>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors duration-200 ${
            activeCategory === null
              ? "bg-primary/15 text-primary border-primary/30"
              : "bg-surface-container text-on-surface-variant border-outline-variant hover:bg-surface-container-high"
          }`}
        >
          All
        </button>
        {TOOL_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() =>
              setActiveCategory(activeCategory === cat.id ? null : cat.id)
            }
            className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors duration-200 ${
              activeCategory === cat.id
                ? "bg-primary/15 text-primary border-primary/30"
                : "bg-surface-container text-on-surface-variant border-outline-variant hover:bg-surface-container-high"
            }`}
          >
            {cat.emoji} {cat.name}{" "}
            <span className="opacity-60">({cat.toolCount})</span>
          </button>
        ))}
      </div>

      {/* Tool count summary */}
      <p className="text-sm text-on-surface-variant">
        Showing {visibleToolCount} of {TOTAL_TOOLS} tools
      </p>

      {/* Category sections */}
      {visibleCategories.map((cat) => (
        <section key={cat.id} className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">{cat.emoji}</span>
            <div>
              <h3 className="text-base font-semibold text-on-surface">
                {cat.name}
              </h3>
              <p className="text-sm text-on-surface-variant">
                {cat.description}
              </p>
            </div>
            <span className="ml-auto rounded-full bg-surface-container px-2.5 py-0.5 text-xs font-medium text-on-surface-variant">
              {cat.toolCount} tools
            </span>
          </div>

          <div className="space-y-2">
            {cat.tools.map((tool) => (
              <ToolCard key={tool.name} tool={tool} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
