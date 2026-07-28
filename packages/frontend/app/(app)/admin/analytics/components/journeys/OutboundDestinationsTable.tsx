/**
 * OutboundDestinationsTable
 *
 * Where visitors go when they click off the site, by destination domain.
 *
 * Only link clicks are observable. A browser gives the departing page no access
 * to where a navigation lands, so visitors who leave via a typed URL, bookmark,
 * or by closing the tab never appear here — that is a browser constraint, not
 * missing instrumentation. The footnote below says so in the UI, so the numbers
 * are not read as a complete account of every exit.
 */

"use client";

import type { OutboundDestination } from "@/lib/data/fetchers/admin-analytics.types";

interface OutboundDestinationsTableProps {
  destinations: OutboundDestination[];
  onDrillDown?: (key: string, value: string) => void;
}

export function OutboundDestinationsTable({
  destinations,
  onDrillDown,
}: OutboundDestinationsTableProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant">
        <h3 className="text-sm font-medium text-on-surface">
          Outbound Destinations
        </h3>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Where visitors go when they click away
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="text-left py-2.5 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Destination
              </th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Most Common From
              </th>
              <th className="text-right py-2.5 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Clicks
              </th>
              <th className="text-right py-2.5 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Sessions
              </th>
            </tr>
          </thead>
          <tbody>
            {destinations.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-10 text-center text-xs text-on-surface-variant"
                >
                  No outbound clicks recorded yet.
                </td>
              </tr>
            ) : (
              destinations.map((destination) => (
                <tr
                  key={destination.domain}
                  onClick={() =>
                    onDrillDown?.("outboundDomain", destination.domain)
                  }
                  className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container cursor-pointer transition-colors"
                >
                  <td
                    className="py-3 px-4 font-mono text-xs text-on-surface max-w-[220px] truncate"
                    title={destination.topUrl || destination.domain}
                  >
                    {destination.domain}
                  </td>
                  <td
                    className="py-3 px-4 font-mono text-xs text-on-surface-variant max-w-[200px] truncate"
                    title={destination.fromPage}
                  >
                    {destination.fromPage || "—"}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-on-surface">
                    {destination.clicks.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-on-surface-variant">
                    {destination.sessions.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-outline-variant">
        <p className="text-xs text-on-surface-variant">
          Link clicks only. Visitors who leave by typing a URL, using a
          bookmark, or closing the tab cannot be attributed to a destination.
        </p>
      </div>
    </div>
  );
}
