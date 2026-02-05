'use client';

import React, { useMemo, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { useD3, useD3Tooltip, D3Tooltip, useResponsiveD3 } from './hooks/useD3';
import {
  CHART_COLORS,
  createValueScale,
  FormatType,
  getFormatter,
} from './utils/scales';

interface TreemapNode {
  name: string;
  value?: number;
  children?: TreemapNode[];
  colorValue?: number;
}

interface TreemapProps {
  data: TreemapNode;
  colorBy?: 'value' | 'colorValue';
  colorScale?: 'sequential' | 'diverging';
  valueFormat?: FormatType;
  colorFormat?: FormatType;
  showLabels?: boolean;
  padding?: number;
  height?: number;
  className?: string;
  onNodeClick?: (node: TreemapNode, path: string[]) => void;
}

type HierarchyNode = d3.HierarchyRectangularNode<TreemapNode>;

export const Treemap: React.FC<TreemapProps> = ({
  data,
  colorBy = 'value',
  colorScale = 'sequential',
  valueFormat = 'currency',
  colorFormat = 'percent',
  showLabels = true,
  padding = 2,
  height = 500,
  className = '',
  onNodeClick,
}) => {
  const { containerRef, width } = useResponsiveD3<HTMLDivElement>(16 / 10, height);
  const { tooltip, showTooltip, hideTooltip, moveTooltip } = useD3Tooltip();
  const [breadcrumb, setBreadcrumb] = useState<string[]>([data.name]);
  const [currentData, setCurrentData] = useState(data);

  // Build hierarchy and treemap layout
  const treemapData = useMemo(() => {
    if (!width) return null;

    const root = d3
      .hierarchy(currentData)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const treemap = d3
      .treemap<TreemapNode>()
      .size([width, height])
      .padding(padding)
      .round(true);

    return treemap(root);
  }, [currentData, width, height, padding]);

  // Color scale
  const getColor = useMemo(() => {
    if (!treemapData) return () => CHART_COLORS.primary;

    const leaves = treemapData.leaves();
    const values = leaves.map((d) =>
      colorBy === 'colorValue' ? d.data.colorValue ?? 0 : d.value ?? 0
    );
    const extent = d3.extent(values) as [number, number];

    const scale = createValueScale(extent, colorScale, 'purple');

    return (node: HierarchyNode) => {
      const value = colorBy === 'colorValue' ? node.data.colorValue ?? 0 : node.value ?? 0;
      return scale(value) as string;
    };
  }, [treemapData, colorBy, colorScale]);

  // Handle node click (drill down)
  const handleClick = useCallback(
    (node: HierarchyNode) => {
      if (node.children && node.children.length > 0) {
        setCurrentData(node.data);
        setBreadcrumb((prev) => [...prev, node.data.name]);
        onNodeClick?.(node.data, [...breadcrumb, node.data.name]);
      } else {
        onNodeClick?.(node.data, breadcrumb);
      }
    },
    [breadcrumb, onNodeClick]
  );

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      if (index === 0) {
        setCurrentData(data);
        setBreadcrumb([data.name]);
      } else {
        // Navigate back through hierarchy
        let current = data;
        const newBreadcrumb = [data.name];

        for (let i = 1; i <= index; i++) {
          const child = current.children?.find((c) => c.name === breadcrumb[i]);
          if (child) {
            current = child;
            newBreadcrumb.push(child.name);
          }
        }

        setCurrentData(current);
        setBreadcrumb(newBreadcrumb);
      }
    },
    [data, breadcrumb]
  );

  // Handle tooltip
  const handleMouseOver = useCallback(
    (event: React.MouseEvent, node: HierarchyNode) => {
      const valueFormatter = getFormatter(valueFormat);
      const colorFormatter = getFormatter(colorFormat);

      const content = (
        <div className="space-y-1">
          <div className="font-medium">{node.data.name}</div>
          <div className="text-xs">
            <div className="flex justify-between gap-4">
              <span className="opacity-75">Value:</span>
              <span>{valueFormatter(node.value ?? 0)}</span>
            </div>
            {node.data.colorValue !== undefined && (
              <div className="flex justify-between gap-4">
                <span className="opacity-75">Change:</span>
                <span>{colorFormatter(node.data.colorValue)}</span>
              </div>
            )}
            {node.parent && (
              <div className="flex justify-between gap-4">
                <span className="opacity-75">% of parent:</span>
                <span>
                  {(((node.value ?? 0) / (node.parent.value ?? 1)) * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      );
      showTooltip(event.clientX, event.clientY, content);
    },
    [showTooltip, valueFormat, colorFormat]
  );

  // Determine if label should be shown
  const shouldShowLabel = (node: HierarchyNode) => {
    if (!showLabels) return false;
    const nodeWidth = node.x1 - node.x0;
    const nodeHeight = node.y1 - node.y0;
    return nodeWidth > 40 && nodeHeight > 30;
  };

  if (!treemapData) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-container rounded-2xl ${className}`}
        style={{ height }}
      >
        <p className="text-on-surface-variant">Loading...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Breadcrumb */}
      {breadcrumb.length > 1 && (
        <div className="flex items-center gap-1 mb-2 text-sm">
          {breadcrumb.map((item, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <span className="text-on-surface-variant">/</span>
              )}
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className={`
                  px-2 py-0.5 rounded
                  ${index === breadcrumb.length - 1
                    ? 'bg-primary-container text-on-primary-container font-medium'
                    : 'text-primary hover:bg-surface-container'
                  }
                `}
              >
                {item}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Treemap */}
      <svg width={width} height={height} className="overflow-visible">
        <g>
          {treemapData.leaves().map((node, i) => {
            const nodeWidth = node.x1 - node.x0;
            const nodeHeight = node.y1 - node.y0;

            return (
              <g key={i}>
                <rect
                  x={node.x0}
                  y={node.y0}
                  width={nodeWidth}
                  height={nodeHeight}
                  fill={getColor(node)}
                  stroke={CHART_COLORS.surface}
                  strokeWidth={1}
                  rx={4}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onMouseEnter={(e) => handleMouseOver(e, node)}
                  onMouseMove={(e) => moveTooltip(e.clientX, e.clientY)}
                  onMouseLeave={hideTooltip}
                  onClick={() => handleClick(node)}
                />
                {shouldShowLabel(node) && (
                  <foreignObject
                    x={node.x0 + 4}
                    y={node.y0 + 4}
                    width={nodeWidth - 8}
                    height={nodeHeight - 8}
                    className="pointer-events-none overflow-hidden"
                  >
                    <div className="h-full flex flex-col justify-between">
                      <div
                        className="text-white text-xs font-medium leading-tight"
                        style={{
                          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {node.data.name}
                      </div>
                      {nodeHeight > 50 && (
                        <div
                          className="text-white/80 text-[10px]"
                          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                        >
                          {getFormatter(valueFormat)(node.value ?? 0)}
                        </div>
                      )}
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <D3Tooltip {...tooltip} />
    </div>
  );
};

export default Treemap;
