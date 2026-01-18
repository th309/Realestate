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
  const [setRef, inView] = useInView();

  useEffect(() => {
    if (!inView) return;

    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [inView, end, duration]);

  return (
    <span ref={setRef}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}
