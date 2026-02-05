'use client';

import React, { useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { useD3, useD3Tooltip, D3Tooltip, useResponsiveD3 } from './hooks/useD3';
import {
  CHART_COLORS,
  createLinearScale,
  createSizeScale,
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

export interface ScatterDataPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  size?: number;
  category?: string;
  tooltip?: React.ReactNode;
}

interface ScatterPlotProps {
  data: ScatterDataPoint[];
  xLabel?: string;
  yLabel?: string;
  xFormat?: FormatType;
  yFormat?: FormatType;
  showRegression?: boolean;
  showQuadrants?: boolean;
  quadrantLabels?: {
    topLeft?: string;
    topRight?: string;
    bottomLeft?: string;
    bottomRight?: string;
  };
  colorByCategory?: boolean;
  sizeByValue?: boolean;
  height?: number;
  className?: string;
  onPointClick?: (point: ScatterDataPoint) => void;
}

export const ScatterPlot: React.FC<ScatterPlotProps> = ({
  data,
  xLabel,
  yLabel,
  xFormat = 'number',
  yFormat = 'number',
  showRegression = false,
  showQuadrants = false,
  quadrantLabels,
  colorByCategory = true,
  sizeByValue = true,
  height = 400,
  className = '',
  onPointClick,
}) => {
  const { containerRef, width } = useResponsiveD3<HTMLDivElement>(16 / 10, height);
  const { tooltip, showTooltip, hideTooltip, moveTooltip } = useD3Tooltip();

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

  // Calculate scales
  const scales = useMemo(() => {
    if (data.length === 0) return null;

    const xExtent = d3.extent(data, (d) => d.x) as [number, number];
    const yExtent = d3.extent(data, (d) => d.y) as [number, number];

    const xScale = createLinearScale(xExtent, [0, chartWidth]);
    const yScale = createLinearScale(yExtent, [chartHeight, 0]);

    // Size scale
    const sizeExtent: [number, number] = sizeByValue
      ? (d3.extent(data, (d) => d.size ?? 1) as [number, number])
      : [1, 1];
    const sizeScale = createSizeScale(sizeExtent, [6, 24]);

    // Color scale
    const categories = [...new Set(data.map((d) => d.category || 'default'))];
    const colorScale = categoricalScale(categories);

    return { xScale, yScale, sizeScale, colorScale, xExtent, yExtent };
  }, [data, chartWidth, chartHeight, sizeByValue]);

  // Calculate regression line
  const regressionLine = useMemo(() => {
    if (!showRegression || data.length < 2 || !scales) return null;

    const n = data.length;
    const sumX = d3.sum(data, (d) => d.x);
    const sumY = d3.sum(data, (d) => d.y);
    const sumXY = d3.sum(data, (d) => d.x * d.y);
    const sumX2 = d3.sum(data, (d) => d.x * d.x);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const x1 = scales.xExtent[0];
    const x2 = scales.xExtent[1];
    const y1 = slope * x1 + intercept;
    const y2 = slope * x2 + intercept;

    return { x1, y1, x2, y2, slope, intercept };
  }, [data, showRegression, scales]);

  // Handle point interactions
  const handleMouseOver = useCallback(
    (event: React.MouseEvent, point: ScatterDataPoint) => {
      const content = point.tooltip || (
        <div>
          <div className="font-medium">{point.label}</div>
          <div className="text-xs opacity-75">
            {xLabel}: {getFormatter(xFormat)(point.x)}
          </div>
          <div className="text-xs opacity-75">
            {yLabel}: {getFormatter(yFormat)(point.y)}
          </div>
        </div>
      );
      showTooltip(event.clientX, event.clientY, content);
    },
    [showTooltip, xLabel, yLabel, xFormat, yFormat]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      moveTooltip(event.clientX, event.clientY);
    },
    [moveTooltip]
  );

  // Render
  const svgRef = useD3<SVGSVGElement>(
    (svg) => {
      if (!scales) return;

      svg.selectAll('*').remove();

      const { xScale, yScale, sizeScale, colorScale } = scales;

      // Create main group with margins
      const g = svg
        .append('g')
        .attr('transform', `translate(${margins.left},${margins.top})`);

      // Quadrants
      if (showQuadrants) {
        const midX = (scales.xExtent[0] + scales.xExtent[1]) / 2;
        const midY = (scales.yExtent[0] + scales.yExtent[1]) / 2;

        // Vertical line
        g.append('line')
          .attr('x1', xScale(midX))
          .attr('x2', xScale(midX))
          .attr('y1', 0)
          .attr('y2', chartHeight)
          .attr('stroke', CHART_COLORS.outlineVariant)
          .attr('stroke-dasharray', '4,4')
          .attr('stroke-opacity', 0.5);

        // Horizontal line
        g.append('line')
          .attr('x1', 0)
          .attr('x2', chartWidth)
          .attr('y1', yScale(midY))
          .attr('y2', yScale(midY))
          .attr('stroke', CHART_COLORS.outlineVariant)
          .attr('stroke-dasharray', '4,4')
          .attr('stroke-opacity', 0.5);

        // Quadrant labels
        if (quadrantLabels) {
          const labelStyle = {
            fill: CHART_COLORS.onSurfaceVariant,
            'font-size': '10px',
            'font-weight': '500',
            opacity: 0.6,
          };

          if (quadrantLabels.topLeft) {
            g.append('text')
              .attr('x', 10)
              .attr('y', 20)
              .attr('fill', labelStyle.fill)
              .attr('font-size', labelStyle['font-size'])
              .attr('opacity', labelStyle.opacity)
              .text(quadrantLabels.topLeft);
          }
          if (quadrantLabels.topRight) {
            g.append('text')
              .attr('x', chartWidth - 10)
              .attr('y', 20)
              .attr('text-anchor', 'end')
              .attr('fill', labelStyle.fill)
              .attr('font-size', labelStyle['font-size'])
              .attr('opacity', labelStyle.opacity)
              .text(quadrantLabels.topRight);
          }
          if (quadrantLabels.bottomLeft) {
            g.append('text')
              .attr('x', 10)
              .attr('y', chartHeight - 10)
              .attr('fill', labelStyle.fill)
              .attr('font-size', labelStyle['font-size'])
              .attr('opacity', labelStyle.opacity)
              .text(quadrantLabels.bottomLeft);
          }
          if (quadrantLabels.bottomRight) {
            g.append('text')
              .attr('x', chartWidth - 10)
              .attr('y', chartHeight - 10)
              .attr('text-anchor', 'end')
              .attr('fill', labelStyle.fill)
              .attr('font-size', labelStyle['font-size'])
              .attr('opacity', labelStyle.opacity)
              .text(quadrantLabels.bottomRight);
          }
        }
      }

      // Regression line
      if (regressionLine) {
        g.append('line')
          .attr('x1', xScale(regressionLine.x1))
          .attr('x2', xScale(regressionLine.x2))
          .attr('y1', yScale(regressionLine.y1))
          .attr('y2', yScale(regressionLine.y2))
          .attr('stroke', CHART_COLORS.baseline)
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '6,4')
          .attr('opacity', 0.7);
      }

      // Points
      g.selectAll('circle')
        .data(data)
        .join('circle')
        .attr('cx', (d) => xScale(d.x))
        .attr('cy', (d) => yScale(d.y))
        .attr('r', (d) => (sizeByValue ? sizeScale(d.size ?? 1) : 8))
        .attr('fill', (d) =>
          colorByCategory ? colorScale(d.category || 'default') : CHART_COLORS.primary
        )
        .attr('fill-opacity', 0.7)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .attr('cursor', onPointClick ? 'pointer' : 'default')
        .on('mouseenter', function () {
          d3.select(this).attr('fill-opacity', 1).attr('stroke-width', 2);
        })
        .on('mouseleave', function () {
          d3.select(this).attr('fill-opacity', 0.7).attr('stroke-width', 1.5);
        });

      // Axes
      const xAxis = createXAxis({
        scale: xScale as unknown as d3.AxisScale<d3.AxisDomain>,
        formatType: xFormat,
        gridLines: true,
      });

      const yAxis = createYAxis({
        scale: yScale as unknown as d3.AxisScale<d3.AxisDomain>,
        formatType: yFormat,
        gridLines: true,
      });

      const xAxisG = g.append('g');
      renderXAxis(xAxisG, xAxis, {
        height: chartHeight,
        gridLines: true,
        gridHeight: chartHeight,
        label: xLabel,
      });

      const yAxisG = g.append('g');
      renderYAxis(yAxisG, yAxis, {
        gridLines: true,
        gridWidth: chartWidth,
        label: yLabel,
      });
    },
    [data, scales, regressionLine, chartWidth, chartHeight, margins, showQuadrants, quadrantLabels, colorByCategory, sizeByValue, xFormat, yFormat, xLabel, yLabel, onPointClick]
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
      <svg
        ref={svgRef}
        width={width || '100%'}
        height={height}
        className="overflow-visible"
      >
        {/* Points need event handlers from React */}
        <g transform={`translate(${margins.left},${margins.top})`}>
          {scales &&
            data.map((point) => (
              <circle
                key={point.id}
                cx={scales.xScale(point.x)}
                cy={scales.yScale(point.y)}
                r={sizeByValue ? scales.sizeScale(point.size ?? 1) : 8}
                fill="transparent"
                onMouseEnter={(e) => handleMouseOver(e, point)}
                onMouseMove={handleMouseMove}
                onMouseLeave={hideTooltip}
                onClick={() => onPointClick?.(point)}
                style={{ cursor: onPointClick ? 'pointer' : 'default' }}
              />
            ))}
        </g>
      </svg>

      <D3Tooltip {...tooltip} />
    </div>
  );
};

export default ScatterPlot;
