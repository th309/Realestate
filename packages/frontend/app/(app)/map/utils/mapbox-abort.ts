/**
 * Mapbox aborts in-flight tile/style/worker requests on camera moves, resize,
 * satellite layer loads, the cinematic zoom, and teardown. Those reject
 * ASYNCHRONOUSLY as a benign "signal is aborted without reason" (AbortError) and
 * otherwise surface as an uncaught runtime error / Next.js error overlay.
 *
 * Install this for the lifetime of any component that owns a Mapbox map (the
 * full /map page via useMapInstance, and the homepage MapShowcase). Returns a
 * cleanup that detaches the listener AFTER the teardown microtask flush, so we
 * keep swallowing through teardown but never suppress unrelated AbortErrors.
 */
export function installMapboxAbortSwallow(): () => void {
  const swallow = (event: PromiseRejectionEvent) => {
    const reason = event.reason as { name?: string } | undefined;
    if (reason?.name === "AbortError") event.preventDefault();
  };
  window.addEventListener("unhandledrejection", swallow);
  return () => {
    setTimeout(
      () => window.removeEventListener("unhandledrejection", swallow),
      0,
    );
  };
}
