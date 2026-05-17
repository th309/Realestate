"use client";

import { useEffect, useRef, useState } from "react";

export interface UseCountUpOptions {
  durationMs?: number;
  precision?: number;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function useCountUp(
  target: number,
  opts: UseCountUpOptions = {},
): number {
  const { durationMs = 300, precision = 0 } = opts;
  const [value, setValue] = useState(target);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef<number>(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.requestAnimationFrame) {
      setValue(target);
      return;
    }
    fromRef.current = value;
    startRef.current = null;
    const factor = Math.pow(10, precision);

    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(t);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setValue(Math.round(next * factor) / factor);
      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        setValue(Math.round(target * factor) / factor);
      }
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs, precision]);

  return value;
}
