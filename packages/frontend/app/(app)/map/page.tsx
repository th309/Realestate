"use client";

import dynamic from "next/dynamic";
import { MapPageSkeleton } from "./MapPageSkeleton";

// mapbox-gl (~200KB+ gzipped) and the ~12 map hooks/utils that import it are
// only needed on this route. MapPageInner is code-split into its own chunk
// via next/dynamic({ ssr: false }) so mapbox-gl never ships in another
// route's first-load JS; MapPageSkeleton (previously the Suspense fallback)
// now doubles as the dynamic-import loading state.
const MapPageInner = dynamic(() => import("./MapPageInner"), {
  ssr: false,
  loading: () => <MapPageSkeleton />,
});

export default function MapPage() {
  return <MapPageInner />;
}
