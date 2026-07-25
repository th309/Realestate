/**
 * Per-platform reach/engagement/posts for the window. A compact table that
 * scrolls horizontally on small screens. Hidden when there's no platform data.
 */
import type { PlatformInsight } from "../lib/insights-api";
import { PlatformGlyph } from "../planner/platform-glyph";
import { formatCompactNumber } from "./insights-format";

export function PlatformBreakdown({ rows }: { rows: PlatformInsight[] }) {
  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="platform-breakdown-heading"
      className="rounded-xl border border-outline-variant bg-surface-container-low shadow-sm"
    >
      <h2
        id="platform-breakdown-heading"
        className="border-b border-outline-variant px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant"
      >
        By platform
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
            <tr className="text-left">
              <th className="px-5 py-2 font-medium">Platform</th>
              <th className="px-5 py-2 text-right font-medium">Reach</th>
              <th className="px-5 py-2 text-right font-medium">Engagement</th>
              <th className="px-5 py-2 text-right font-medium">Posts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.platform}
                className="border-t border-outline-variant text-on-surface"
              >
                <td className="px-5 py-3">
                  <span className="inline-flex items-center gap-2">
                    <PlatformGlyph platform={row.platform} />
                    <span className="capitalize">{row.platform}</span>
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">
                  {formatCompactNumber(row.reach)}
                </td>
                <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">
                  {formatCompactNumber(row.engagement)}
                </td>
                <td className="px-5 py-3 text-right font-mono text-xs tabular-nums">
                  {row.posts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
