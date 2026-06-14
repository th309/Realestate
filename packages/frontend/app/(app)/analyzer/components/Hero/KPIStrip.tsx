"use client";
import { KPITile, KPITileProps } from "./KPITile";

interface KPIStripProps {
  tiles: KPITileProps[];
}

export function KPIStrip({ tiles }: KPIStripProps) {
  return (
    <div
      data-kpi-strip
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
    >
      {tiles.map((t, i) => (
        <KPITile key={i} {...t} />
      ))}
    </div>
  );
}
