"use client";

import { useEffect, useRef } from "react";

/**
 * The geometric backdrop — indigo nodes joined by faint links wherever two fall
 * close enough together. From the approved mockup, where it ran behind the
 * hero; it now runs behind the whole page.
 *
 * Static, not animated: nothing here moves, so there is no motion to reduce and
 * no frame loop to pay for. It draws once per size or theme change.
 *
 * Colour comes from `--md-primary` at low alpha rather than a second hardcoded
 * palette, so it tracks the theme automatically — the mockup's two literal rgba
 * pairs were the light and dark values of exactly that token.
 *
 * Drawn in an effect rather than during render because the layout is random:
 * generating points during render would produce different markup on the server
 * and the client and trip a hydration mismatch.
 *
 * Mount one per background band, not one for the page. Each band paints its own
 * opaque background, so a single shared canvas would be buried under whichever
 * band came after it.
 */

/** Two nodes link when they are closer than this, in CSS pixels. */
const LINK_DISTANCE = Math.sqrt(20000);
/** One node per this many square pixels. */
const AREA_PER_NODE = 26000;
/**
 * Backing-store ceiling. The page band runs the height of the whole document,
 * so honouring devicePixelRatio there would allocate hundreds of megabytes for
 * decoration. Past this budget the canvas drops toward 1x, which is invisible
 * on a pattern of 1px lines and 1–2px dots.
 */
const MAX_BACKING_PIXELS = 16_000_000;

type Node = { x: number; y: number; r: number };

/** `--md-primary` is authored as a hex literal; canvas needs rgba. */
function primaryRgb(): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--md-primary")
    .trim();
  const hex = raw.replace("#", "");
  if (hex.length !== 6) return "57, 73, 171"; // the light-mode indigo
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");
}

export function Constellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let nodes: Node[] = [];
    let width = 0;
    let height = 0;

    function draw() {
      if (!ctx || !width || !height) return;
      ctx.clearRect(0, 0, width, height);
      const rgb = primaryRgb();

      ctx.strokeStyle = `rgba(${rgb}, 0.10)`;
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          if (dx * dx + dy * dy >= LINK_DISTANCE * LINK_DISTANCE) continue;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }

      ctx.fillStyle = `rgba(${rgb}, 0.30)`;
      for (const node of nodes) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function layout() {
      if (!canvas || !parent || !ctx) return;
      const rect = parent.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      width = rect.width;
      height = rect.height;

      // Back the canvas at device resolution so the 1px links are not blurry on
      // a HiDPI screen, then draw in CSS pixels — but never past the budget.
      const maxScale = Math.sqrt(MAX_BACKING_PIXELS / (width * height));
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, maxScale));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.round((width * height) / AREA_PER_NODE);
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.6 + 0.7,
      }));
      draw();
    }

    layout();

    // The band's height changes as fonts settle, as images load, and as tab
    // panels swap, so observe the band rather than only the window.
    const observer = new ResizeObserver(layout);
    observer.observe(parent);

    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", draw);

    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", draw);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
