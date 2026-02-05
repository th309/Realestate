'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';

/**
 * Hook for using D3.js with React
 * Handles the D3 lifecycle and provides a ref for the SVG element
 */
export function useD3<T extends SVGSVGElement>(
  renderFn: (svg: d3.Selection<T, unknown, null, undefined>) => void,
  deps: React.DependencyList = []
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (ref.current) {
      const svg = d3.select(ref.current);
      renderFn(svg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/**
 * Hook for responsive D3 charts
 * Returns dimensions that update on resize
 */
export function useResponsiveD3<T extends HTMLDivElement>(
  aspectRatio: number = 16 / 9,
  minHeight: number = 200
) {
  const containerRef = useRef<T>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = Math.max(width / aspectRatio, minHeight);
        setDimensions({ width, height });
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [aspectRatio, minHeight]);

  return { containerRef, ...dimensions };
}

/**
 * Hook for D3 zoom behavior
 */
export function useD3Zoom<T extends SVGSVGElement>(
  minZoom: number = 0.5,
  maxZoom: number = 10
) {
  const svgRef = useRef<T>(null);
  const [transform, setTransform] = useState(d3.zoomIdentity);

  const zoom = useCallback(() => {
    return d3
      .zoom<T, unknown>()
      .scaleExtent([minZoom, maxZoom])
      .on('zoom', (event) => {
        setTransform(event.transform);
      });
  }, [minZoom, maxZoom]);

  useEffect(() => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.call(zoom() as any);
    }
  }, [zoom]);

  const resetZoom = useCallback(() => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg
        .transition()
        .duration(300)
        .call((zoom() as any).transform, d3.zoomIdentity);
    }
  }, [zoom]);

  return { svgRef, transform, resetZoom };
}

/**
 * Hook for D3 brush selection
 */
export function useD3Brush<T extends SVGGElement>(
  onBrush: (selection: [[number, number], [number, number]] | null) => void,
  enabled: boolean = true
) {
  const brushRef = useRef<T>(null);

  useEffect(() => {
    if (!brushRef.current || !enabled) return;

    const brush = d3
      .brush()
      .on('brush end', (event: d3.D3BrushEvent<unknown>) => {
        if (event.selection) {
          onBrush(event.selection as [[number, number], [number, number]]);
        } else {
          onBrush(null);
        }
      });

    d3.select(brushRef.current as SVGGElement).call(brush as unknown as (selection: d3.Selection<SVGGElement, unknown, null, undefined>) => void);

    return () => {
      d3.select(brushRef.current).on('.brush', null);
    };
  }, [onBrush, enabled]);

  return brushRef;
}

/**
 * Hook for D3 tooltip
 */
export function useD3Tooltip() {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: React.ReactNode;
  }>({
    visible: false,
    x: 0,
    y: 0,
    content: null,
  });

  const showTooltip = useCallback(
    (x: number, y: number, content: React.ReactNode) => {
      setTooltip({ visible: true, x, y, content });
    },
    []
  );

  const hideTooltip = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const moveTooltip = useCallback((x: number, y: number) => {
    setTooltip((prev) => ({ ...prev, x, y }));
  }, []);

  return { tooltip, showTooltip, hideTooltip, moveTooltip };
}

/**
 * D3 Tooltip component
 */
interface D3TooltipProps {
  visible: boolean;
  x: number;
  y: number;
  content: React.ReactNode;
  className?: string;
}

export const D3Tooltip: React.FC<D3TooltipProps> = ({
  visible,
  x,
  y,
  content,
  className = '',
}) => {
  if (!visible) return null;

  return (
    <div
      className={`
        fixed pointer-events-none z-50
        bg-inverse-surface text-inverse-on-surface
        px-3 py-2 rounded-lg text-sm
        shadow-lg
        animate-in fade-in duration-150
        ${className}
      `}
      style={{
        left: x + 10,
        top: y - 10,
        transform: 'translateY(-100%)',
      }}
    >
      {content}
    </div>
  );
};
