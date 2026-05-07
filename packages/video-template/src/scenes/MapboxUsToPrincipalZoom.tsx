import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  Easing,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import mapboxgl, { type Map as MapboxMap } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  PRINCIPAL_CITY_END_ZOOM,
  US_MAP_CENTER_LNG_LAT,
  US_MAP_START_ZOOM,
} from "../constants/map-camera";
import { COLORS } from "../constants";
import { Intro } from "./Intro";

type MapboxUsToPrincipalZoomProps = {
  /** Intro segment length (parent `Sequence` duration). */
  durationInFrames: number;
  targetLongitude: number;
  targetLatitude: number;
  marketLabel: string;
};

const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

/**
 * In Studio / CLI, `REMOTION_MAPBOX_TOKEN` is set at **bundle time** from
 * `inject-mapbox-token.ts` (merging the same env names the Next.js map uses).
 */
function getMapboxToken(): string | undefined {
  const t = process.env.REMOTION_MAPBOX_TOKEN;
  if (typeof t === "string" && t.trim().length > 0) return t.trim();
  return undefined;
}

/**
 * Long-form chapter 1: Mapbox `streets-v12` (same GL stack as the site).
 * Camera interpolates from a continental US view to the resolved geography
 * point (`geographies.latitude/longitude` from the pipeline — shared with map fly-to).
 */
export const MapboxUsToPrincipalZoom: React.FC<MapboxUsToPrincipalZoomProps> = ({
  durationInFrames,
  targetLongitude,
  targetLatitude,
  marketLabel,
}) => {
  const token = getMapboxToken();
  if (!token) {
    return <Intro marketName={marketLabel} />;
  }

  return (
    <MapboxUsToPrincipalZoomInner
      durationInFrames={durationInFrames}
      targetLongitude={targetLongitude}
      targetLatitude={targetLatitude}
      marketLabel={marketLabel}
      token={token}
    />
  );
};

const MapboxUsToPrincipalZoomInner: React.FC<
  MapboxUsToPrincipalZoomProps & { token: string }
> = ({
  durationInFrames,
  targetLongitude,
  targetLatitude,
  marketLabel,
  token,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [loadHandle] = useState(() => delayRender("mapbox-load"));
  const [mapLoaded, setMapLoaded] = useState(false);

  const safeDuration = Math.max(1, durationInFrames);
  const easeEndFrame = Math.max(1, Math.floor(safeDuration * 0.92));

  const t = interpolate(frame, [0, easeEndFrame], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const centerLng = useMemo(
    () =>
      US_MAP_CENTER_LNG_LAT[0] +
      (targetLongitude - US_MAP_CENTER_LNG_LAT[0]) * t,
    [t, targetLongitude],
  );
  const centerLat = useMemo(
    () =>
      US_MAP_CENTER_LNG_LAT[1] +
      (targetLatitude - US_MAP_CENTER_LNG_LAT[1]) * t,
    [t, targetLatitude],
  );
  const zoom = useMemo(
    () => US_MAP_START_ZOOM + (PRINCIPAL_CITY_END_ZOOM - US_MAP_START_ZOOM) * t,
    [t],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [US_MAP_CENTER_LNG_LAT[0], US_MAP_CENTER_LNG_LAT[1]],
      zoom: US_MAP_START_ZOOM,
      interactive: false,
      fadeDuration: 0,
      attributionControl: false,
    });

    let finished = false;
    const unblock = () => {
      if (finished) return;
      finished = true;
      continueRender(loadHandle);
    };

    const failSafe = window.setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn("[MapboxUsToPrincipalZoom] Map load timed out — unblocking render.");
      unblock();
    }, 15_000);

    map.on("load", () => {
      window.clearTimeout(failSafe);
      setMapLoaded(true);
      unblock();
    });

    map.on("error", (ev) => {
      window.clearTimeout(failSafe);
      // eslint-disable-next-line no-console
      console.warn("[MapboxUsToPrincipalZoom]", ev);
      unblock();
    });

    mapRef.current = map;
  }, [token, continueRender, loadHandle]);

  useEffect(() => {
    if (!mapLoaded) return;
    const map = mapRef.current;
    if (!map) return;
    map.jumpTo({
      center: [centerLng, centerLat],
      zoom,
      pitch: 0,
      bearing: 0,
    });
  }, [mapLoaded, centerLng, centerLat, zoom]);

  const labelShadow = useMemo(() => `0 2px 12px ${COLORS.bg}`, []);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <div
        ref={containerRef}
        style={{
          width,
          height,
          position: "absolute",
          left: 0,
          top: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: 0,
          right: 0,
          textAlign: "center",
          pointerEvents: "none",
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          fontSize: 26,
          fontWeight: 700,
          color: COLORS.text,
          textShadow: labelShadow,
        }}
      >
        {marketLabel}
      </div>
    </AbsoluteFill>
  );
};
