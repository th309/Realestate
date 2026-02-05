'use client';

import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { useD3, useD3Tooltip, D3Tooltip, useResponsiveD3 } from './hooks/useD3';
import {
  CHART_COLORS,
  createLinearScale,
  createBandScale,
  categoricalScale,
  FormatType,
  getFormatter,
} from './utils/scales';
import {
  createXAxis,
  createYAxis,
  renderXAxis,
  renderYAxis,
  getChartDimensions,
} from './utils/axes';

interface BoxPlotData {
  category: string;
  values: number[];
}

interface BoxPlotStats {
  category: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
  color: string;
}

interface BoxPlotProps {
  data: BoxPlotData[];
  yLabel?: string;
  yFormat?: FormatType;
  showOutliers?: boolean;
  showViolin?: boolean;
  horizontal?: boolean;
  height?: number;
  className?: string;
}

function calculateBoxPlotStats(values: number[]): {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
} {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = d3.quantile(sorted, 0.25) ?? 0;
  const median = d3.quantile(sorted, 0.5) ?? 0;
  const q3 = d3.quantile(sorted, 0.75) ?? 0;
  const iqr = q3 - q1;

  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);
  const min = Math.max(sorted[0], lowerFence);
  const max = Math.min(sorted[sorted.length - 1], upperFence);

  return { min, q1, median, q3, max, outliers };
}

export const BoxPlot: React.FC<BoxPlotProps> = ({
  data,
  yLabel,
  yFormat = 'number',
  showOutliers = true,
  showViolin = false,
  horizontal = false,
  height = 400,
  className = '',
}) => {
  const { containerRef, width } = useResponsiveD3<HTMLDivElement>(16 / 10, height);
  const { tooltip, showTooltip, hideTooltip } = useD3Tooltip();

  // Calculate dimensions
  const { width: chartWidth, height: chartHeight, margins } = useMemo(
    () =>
      getChartDimensions(width || 600, height, {
        left: 60,
        bottom: 50,
        right: 20,
        top: 20,
      }),
    [width, height]
  );

  // Calculate stats for each category
  const stats: BoxPlotStats[] = useMemo(() => {
    const colorScale = categoricalScale(data.map((d) => d.category));

    return data.map((d) => ({
      category: d.category,
      ...calculateBoxPlotStats(d.values),
      color: colorScale(d.category),
    }));
  }, [data]);

  // Calculate scales
  const scales = useMemo(() => {
    if (stats.length === 0) return null;

    const allValues = data.flatMap((d) => d.values);
    const valueExtent = d3.extent(allValues) as [number, number];
    const categories = data.map((d) => d.category);

    if (horizontal) {
      const xScale = createLinearScale(valueExtent, [0, chartWidth]);
      const yScale = createBandScale(categories, [0, chartHeight], 0.3);
      return { xScale, yScale, valueScale: xScale, categoryScale: yScale };
    } else {
      const xScale = createBandScale(categories, [0, chartWidth], 0.3);
      const yScale = createLinearScale(valueExtent, [chartHeight, 0]);
      return { xScale, yScale, valueScale: yScale, categoryScale: xScale };
    }
  }, [stats, data, chartWidth, chartHeight, horizontal]);

  // Handle tooltip
  const handleMouseOver = useCallback(
    (event: React.MouseEvent, stat: BoxPlotStats) => {
      const formatter = getFormatter(yFormat);
      const content = (
        <div className="space-y-1">
          <div className="font-medium">{stat.category}</div>
          <div className="text-xs grid grid-cols-2 gap-x-4">
            <span className="opacity-75">Max:</span>
            <span>{formatter(stat.max)}</span>
            <span className="opacity-75">Q3:</span>
            <span>{formatter(stat.q3)}</span>
            <span className="opacity-75">Median:</span>
            <span className="font-medium">{formatter(stat.median)}</span>
            <span className="opacity-75">Q1:</span>
            <span>{formatter(stat.q1)}</span>
            <span className="opacity-75">Min:</span>
            <span>{formatter(stat.min)}</span>
            {stat.outliers.length > 0 && (
              <>
                <span className="opacity-75">Outliers:</span>
                <span>{stat.outliers.length}</span>
              </>
            )}
          </div>
        </div>
      );
      showTooltip(event.clientX, event.clientY, content);
    },
    [showTooltip, yFormat]
  );

  // Render
  const svgRef = useD3<SVGSVGElement>(
    (svg) => {
      if (!scales) return;

      svg.selectAll('*').remove();

      const g = svg
        .append('g')
        .attr('transform', `translate(${margins.left},${margins.top})`);

      const boxWidth = (scales.categoryScale as d3.ScaleBand<string>).bandwidth();

      // Draw each box
      stats.forEach((stat) => {
        const categoryPos = (scales.categoryScale as d3.ScaleBand<string>)(stat.category) ?? 0;
        const boxGroup = g.append('g');

        if (horizontal) {
          const valueScale = scales.valueScale as d3.ScaleLinear<number, number>;
          const cy = categoryPos + boxWidth / 2;

          // Whisker line (min to max)
          boxGroup
            .append('line')
            .attr('x1', valueScale(stat.min))
            .attr('x2', valueScale(stat.max))
            .attr('y1', cy)
            .attr('y2', cy)
            .attr('stroke', CHART_COLORS.onSurfaceVariant)
            .attr('stroke-width', 1);

          // Min whisker cap
          boxGroup
            .append('line')
            .attr('x1', valueScale(stat.min))
            .attr('x2', valueScale(stat.min))
            .attr('y1', cy - boxWidth * 0.3)
            .attr('y2', cy + boxWidth * 0.3)
            .attr('stroke', CHART_COLORS.onSurfaceVariant)
            .attr('stroke-width', 1);

          // Max whisker cap
          boxGroup
            .append('line')
            .attr('x1', valueScale(stat.max))
            .attr('x2', valueScale(stat.max))
            .attr('y1', cy - boxWidth * 0.3)
            .attr('y2', cy + boxWidth * 0.3)
            .attr('stroke', CHART_COLORS.onSurfaceVariant)
            .attr('stroke-width', 1);

          // Box (Q1 to Q3)
          boxGroup
            .append('rect')
            .attr('x', valueScale(stat.q1))
            .attr('y', categoryPos + boxWidth * 0.1)
            .attr('width', valueScale(stat.q3) - valueScale(stat.q1))
            .attr('height', boxWidth * 0.8)
            .attr('fill', stat.color)
            .attr('fill-opacity', 0.7)
            .attr('stroke', stat.color)
            .attr('stroke-width', 2)
            .attr('rx', 4);

          // Median line
          boxGroup
            .append('line')
            .attr('x1', valueScale(stat.median))
            .attr('x2', valueScale(stat.median))
            .attr('y1', categoryPos + boxWidth * 0.1)
            .attr('y2', categoryPos + boxWidth * 0.9)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

          // Outliers
          if (showOutliers) {
            stat.outliers.forEach((outlier) => {
              boxGroup
                .append('circle')
                .attr('cx', valueScale(outlier))
                .attr('cy', cy)
                .attr('r', 4)
                .attr('fill', stat.color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
            });
          }
        } else {
          const valueScale = scales.valueScale as d3.ScaleLinear<number, number>;
          const cx = categoryPos + boxWidth / 2;

          // Whisker line (min to max)
          boxGroup
            .append('line')
            .attr('x1', cx)
            .attr('x2', cx)
            .attr('y1', valueScale(stat.min))
            .attr('y2', valueScale(stat.max))
            .attr('stroke', CHART_COLORS.onSurfaceVariant)
            .attr('stroke-width', 1);

          // Min whisker cap
          boxGroup
            .append('line')
            .attr('x1', categoryPos + boxWidth * 0.2)
            .attr('x2', categoryPos + boxWidth * 0.8)
            .attr('y1', valueScale(stat.min))
            .attr('y2', valueScale(stat.min))
            .attr('stroke', CHART_COLORS.onSurfaceVariant)
            .attr('stroke-width', 1);

          // Max whisker cap
          boxGroup
            .append('line')
            .attr('x1', categoryPos + boxWidth * 0.2)
            .attr('x2', categoryPos + boxWidth * 0.8)
            .attr('y1', valueScale(stat.max))
            .attr('y2', valueScale(stat.max))
            .attr('stroke', CHART_COLORS.onSurfaceVariant)
            .attr('stroke-width', 1);

          // Box (Q1 to Q3)
          boxGroup
            .append('rect')
            .attr('x', categoryPos + boxWidth * 0.1)
            .attr('y', valueScale(stat.q3))
            .attr('width', boxWidth * 0.8)
            .attr('height', valueScale(stat.q1) - valueScale(stat.q3))
            .attr('fill', stat.color)
            .attr('fill-opacity', 0.7)
            .attr('stroke', stat.color)
            .attr('stroke-width', 2)
            .attr('rx', 4);

          // Median line
          boxGroup
            .append('line')
            .attr('x1', categoryPos + boxWidth * 0.1)
            .attr('x2', categoryPos + boxWidth * 0.9)
            .attr('y1', valueScale(stat.median))
            .attr('y2', valueScale(stat.median))
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

          // Outliers
          if (showOutliers) {
            stat.outliers.forEach((outlier) => {
              boxGroup
                .append('circle')
                .attr('cx', cx)
                .attr('cy', valueScale(outlier))
                .attr('r', 4)
                .attr('fill', stat.color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
            });
          }
        }
      });

      // Axes
      if (horizontal) {
        const xAxis = createXAxis({
          scale: scales.xScale as d3.AxisScale<d3.AxisDomain>,
          formatType: yFormat,
        });
        const yAxis = d3.axisLeft(scales.yScale as d3.ScaleBand<string>);

        const xAxisG = g.append('g');
        renderXAxis(xAxisG, xAxis, {
          height: chartHeight,
          label: yLabel,
        });

        g.append('g').call(yAxis).selectAll('text').attr('fill', CHART_COLORS.onSurfaceVariant);
      } else {
        const xAxis = d3.axisBottom(scales.xScale as d3.ScaleBand<string>);
        const yAxis = createYAxis({
          scale: scales.yScale as d3.AxisScale<d3.AxisDomain>,
          formatType: yFormat,
        });

        g.append('g')
          .attr('transform', `translate(0,${chartHeight})`)
          .call(xAxis)
          .selectAll('text')
          .attr('fill', CHART_COLORS.onSurfaceVariant);

        const yAxisG = g.append('g');
        renderYAxis(yAxisG, yAxis, { label: yLabel });
      }
    },
    [stats, scales, chartWidth, chartHeight, margins, horizontal, showOutliers, yFormat, yLabel]
  );

  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-surface-container rounded-2xl ${className}`} style={{ height }}>
        <p className="text-on-surface-variant">No data available</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <svg ref={svgRef} width={width || '100%'} height={height} className="overflow-visible">
        {/* Invisible overlay for tooltips */}
        <g transform={`translate(${margins.left},${margins.top})`}>
          {scales &&
            stats.map((stat) => {
              const categoryScale = scales.categoryScale as d3.ScaleBand<string>;
              const categoryPos = categoryScale(stat.category) ?? 0;
              const boxWidth = categoryScale.bandwidth();

              return (
                <rect
                  key={stat.category}
                  x={horizontal ? 0 : categoryPos}
                  y={horizontal ? categoryPos : 0}
                  width={horizontal ? chartWidth : boxWidth}
                  height={horizontal ? boxWidth : chartHeight}
                  fill="transparent"
                  onMouseEnter={(e) => handleMouseOver(e, stat)}
                  onMouseLeave={hideTooltip}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}
        </g>
      </svg>

      <D3Tooltip {...tooltip} />
    </div>
  );
};

export default BoxPlot;
