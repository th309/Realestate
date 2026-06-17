export async function triggerConfetti() {
  const confetti = (await import("canvas-confetti")).default;
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#3949ab", "#5c6bc0", "#00c853", "#c5cae9"],
    disableForReducedMotion: true,
  });
}

export function animateScoreCounter(
  element: HTMLElement,
  target: number,
  durationMs = 600,
): () => void {
  const start = performance.now();
  let rafId: number;

  const tick = (now: number) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / durationMs, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);
    element.textContent = String(current);
    if (progress < 1) {
      rafId = requestAnimationFrame(tick);
    }
  };

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}
