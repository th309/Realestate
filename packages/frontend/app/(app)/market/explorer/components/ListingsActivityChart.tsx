"use client";
import React from "react";

export interface ListingsActivityChartProps {
  title: string;
  newListings: (number | null)[];
  pending: (number | null)[];
  months: string[];
  monthIndex: number;
}

const chartWidth = 440,
  chartHeight = 190,
  marginBottom = 22,
  marginTop = 8;

export function ListingsActivityChart({
  title,
  newListings,
  pending,
  months,
  monthIndex,
}: ListingsActivityChartProps) {
  const end = Math.min(monthIndex, newListings.length - 1);
  const start = Math.max(0, end - 11);
  const visibleMonthIndices: number[] = [];
  for (let monthIdx = start; monthIdx <= end; monthIdx++)
    visibleMonthIndices.push(monthIdx);
  const max =
    Math.max(
      1,
      ...visibleMonthIndices.map((monthIdx) =>
        Math.max(newListings[monthIdx] ?? 0, pending[monthIdx] ?? 0),
      ),
    ) * 1.1;
  const barWidth = (chartWidth - 16) / (visibleMonthIndices.length || 1);
  const monthShort = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleString("en-US", {
      month: "short",
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--md-on-surface)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            fontSize: 11,
            color: "var(--md-on-surface-variant)",
            flex: "none",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 3,
                background: "var(--md-primary)",
              }}
            />
            New listings
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 3,
                background: "var(--md-tertiary)",
              }}
            />
            Pending
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="none"
        width="100%"
        style={{ display: "block", height: chartHeight }}
      >
        <line
          x1={6}
          x2={chartWidth - 6}
          y1={chartHeight - marginBottom}
          y2={chartHeight - marginBottom}
          stroke="var(--md-outline-variant)"
        />
        {visibleMonthIndices.map((monthIdx, i) => {
          const x0 = 8 + i * barWidth,
            isCurrentMonth = monthIdx === monthIndex;
          const newListingsBarHeight =
            ((newListings[monthIdx] ?? 0) / max) *
            (chartHeight - marginBottom - marginTop);
          const pendingBarHeight =
            ((pending[monthIdx] ?? 0) / max) *
            (chartHeight - marginBottom - marginTop);
          return (
            <g key={monthIdx}>
              <rect
                x={x0 + barWidth * 0.14}
                width={barWidth * 0.32}
                y={chartHeight - marginBottom - newListingsBarHeight}
                height={newListingsBarHeight}
                rx={3}
                fill="var(--md-primary)"
                fillOpacity={isCurrentMonth ? 1 : 0.55}
              />
              <rect
                x={x0 + barWidth * 0.52}
                width={barWidth * 0.32}
                y={chartHeight - marginBottom - pendingBarHeight}
                height={pendingBarHeight}
                rx={3}
                fill="var(--md-tertiary)"
                fillOpacity={isCurrentMonth ? 1 : 0.55}
              />
              {(i % 2 === 0 || visibleMonthIndices.length <= 8) && (
                <text
                  x={x0 + barWidth / 2}
                  y={chartHeight - 7}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontFamily="var(--font-roboto-mono)"
                  fill={
                    isCurrentMonth
                      ? "var(--md-primary)"
                      : "var(--md-on-surface-variant)"
                  }
                  fontWeight={isCurrentMonth ? 700 : 400}
                >
                  {monthShort(months[monthIdx] ?? "")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
