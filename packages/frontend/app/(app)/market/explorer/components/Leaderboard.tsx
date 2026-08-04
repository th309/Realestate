"use client";
import { DataTable, ScorePill, type Column } from "@/app/components/app-shell";
import { Sparkline } from "./Sparkline";

export interface LeaderboardRow {
  id: string;
  rank: string;
  name: string;
  sub: string;
  valueLabel: string;
  valueColor: string;
  score: number;
  spark: (number | null)[];
  markerIndex: number;
}
export interface LeaderboardProps {
  title: string;
  monthLabel: string;
  rows: LeaderboardRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Market rankings.
 *
 * This was a div grid imitating a table, with a hand-rolled score pill
 * carrying a comment calling itself "a documented exception to CLAUDE.md
 * section 9's ScoreBadge requirement" because the ring would not fit a 76px
 * column. `ScorePill` is exactly that compact form, so the exception is
 * retired rather than documented — colour and momentum label now come from
 * `getScoreColor`/`getScoreLabel` and cannot drift from the same market's
 * score elsewhere.
 */
export function Leaderboard({
  title,
  monthLabel,
  rows,
  selectedId,
  onSelect,
}: LeaderboardProps) {
  const columns: Column<LeaderboardRow>[] = [
    {
      key: "rank",
      header: "#",
      align: "right",
      width: "w-11",
      cellClassName: () => "text-[11.5px] text-on-surface-variant",
      render: (row) => row.rank,
    },
    {
      key: "name",
      header: "Market",
      align: "left",
      render: (row) => (
        <span className="block min-w-0">
          <span className="block truncate text-[13px] font-semibold text-on-surface">
            {row.name}
          </span>
          <span className="block font-mono text-[10.5px] text-on-surface-variant">
            {row.sub}
          </span>
        </span>
      ),
    },
    {
      key: "spark",
      header: "",
      align: "right",
      width: "w-[100px]",
      render: (row) => (
        <Sparkline
          series={row.spark}
          width={92}
          height={26}
          color={row.valueColor}
          markerIndex={row.markerIndex}
        />
      ),
    },
    {
      key: "valueLabel",
      header: "Value",
      align: "right",
      render: (row) => (
        <span className="font-semibold" style={{ color: row.valueColor }}>
          {row.valueLabel}
        </span>
      ),
    },
    {
      key: "score",
      header: "Score",
      align: "right",
      // No `showLabel`: when the ranking metric IS the score, the Value column
      // already carries the momentum word, and a pill repeating it printed
      // "VERY STRONG" twice on the same row. The mockup keeps them separate
      // too — a numeric badge plus its own mono label column.
      render: (row) => <ScorePill score={row.score} />,
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
      <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3.5">
        <h3 className="text-sm font-bold text-on-surface">{title}</h3>
        <span className="font-mono text-[11.5px] text-on-surface-variant">
          {monthLabel}
        </span>
      </div>
      <DataTable
        ariaLabel={title}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        // Selects a market in place rather than navigating, so these are
        // buttons (Enter or Space), not links.
        rowRole="button"
        onRowClick={(row) => onSelect(row.id)}
        rowClassName={(row) =>
          row.id === selectedId ? "bg-primary-container/40" : ""
        }
      />
    </div>
  );
}
