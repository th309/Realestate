"use client";

/**
 * Loads /geojson/states.json (static, browser-cached) and pre-renders it to
 * SVG path strings once per page — every widget instance shares the promise.
 * Basemap failure is non-fatal: dots still render over an empty background.
 */

import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import { buildStatePaths } from "./momentum-map-projection";

let statePathsPromise: Promise<string[]> | null = null;

function loadStatePaths(): Promise<string[]> {
  if (!statePathsPromise) {
    statePathsPromise = fetch("/geojson/states.json")
      .then((res) => {
        if (!res.ok) throw new Error(`states.json ${res.status}`);
        return res.json() as Promise<FeatureCollection>;
      })
      .then(buildStatePaths)
      .catch((error) => {
        statePathsPromise = null; // allow retry on next mount
        throw error;
      });
  }
  return statePathsPromise;
}

export function useUsStatesBasemap(): string[] {
  const [paths, setPaths] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadStatePaths()
      .then((loaded) => {
        if (!cancelled) setPaths(loaded);
      })
      .catch((error) => {
        console.error("Momentum map basemap failed to load:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return paths;
}
