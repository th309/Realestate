'use client';

import { useState, useEffect } from 'react';
import { useInView } from './hooks/useInView';

interface AnimatedCounterProps {
  end: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}

export function AnimatedCounter({
  end,
  suffix = '',
  prefix = '',
  duration = 2000
}: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [setRef, inView] = useInView();

  useEffect(() => {
    if (!inView || hasAnimated) return;

    let startTime: number | null = null;
    let frameId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        setHasAnimated(true);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [inView, end, duration, hasAnimated]);

  // Always display the target value when animation hasn't started yet and
  // we're not in view — ensures the number is never stuck at 0.
  const displayValue = (!inView && !hasAnimated) ? end : count;

  return (
    <span ref={setRef}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
}
