import { MapShowcase } from "@/app/components/home/MapShowcase";

/**
 * Beat 5 — see it on the map.
 *
 * Reuses the proven `MapShowcase` (the same live, interactive Mapbox map as the
 * full /map page), which is a self-contained section with its own heading and
 * lazy-loads mapbox-gl only when scrolled into view — so it costs nothing at
 * first paint and never touches the hero's LCP. We render it as-is (no extra
 * heading — MapShowcase brings its own) behind an anchor for the hero's "see how
 * the Score works" flow.
 *
 * The richer scroll-triggered cinematic fly/spotlight is a separate, flag-gated
 * feature (NEXT_PUBLIC_CINEMATIC_ZOOM, docs/superpowers/specs/2026-06-20-map-
 * cinematic-geo-zoom-design.md); this beat opts into it once that ships.
 *
 * BAND: this is the one deliberately dark beat. MapShowcase is shared with the
 * variant-A homepage and paints its own light-on-dark copy, so it needs a dark
 * backdrop. It used to borrow that from the page-wide indigo gradient; now that
 * every other beat owns an opaque light band, that gradient only showed through
 * here as a bare slab, so the beat carries the dark surface itself.
 */
export function BeatMap() {
  return (
    <div id="beat-map" className="bg-inverse-surface">
      <MapShowcase />
    </div>
  );
}
