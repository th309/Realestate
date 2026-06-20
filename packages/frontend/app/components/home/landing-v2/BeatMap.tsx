import { BeatSection } from "./BeatSection";
import { MapShowcase } from "@/app/components/home/MapShowcase";

/**
 * Beat 5 — see it on the map.
 *
 * Reuses the proven `MapShowcase` (the same live, interactive Mapbox map as the
 * full /map page), which lazy-loads mapbox-gl only when scrolled into view — so
 * it costs nothing at first paint and never touches the hero's LCP. The richer
 * scroll-triggered cinematic fly/spotlight is a separate, flag-gated feature
 * (NEXT_PUBLIC_CINEMATIC_ZOOM, docs/superpowers/specs/2026-06-20-map-cinematic-
 * geo-zoom-design.md); this beat opts into it once that ships.
 */
export function BeatMap() {
  return (
    <BeatSection id="beat-map" eyebrow="See it" tone="light">
      <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-5xl">
        It&apos;s not a spreadsheet. It&apos;s a map.
      </h2>
      <p className="mt-4 max-w-2xl text-lg text-on-surface-variant">
        Every score, rent, and forecast is spatial. Scan a whole metro, drill to
        a single ZIP, and see where the data actually points — the same live map
        that runs inside PropertyIQ.
      </p>
      <div className="mt-8 overflow-hidden rounded-2xl shadow-lg">
        <MapShowcase />
      </div>
      <a
        href="/map"
        className="mt-5 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Explore the full map →
      </a>
    </BeatSection>
  );
}
