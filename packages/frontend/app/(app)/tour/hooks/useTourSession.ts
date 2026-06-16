"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { MarketRef, Persona, TourPhase, TourSession } from "../types";
import { parseMarket as parseMarketParam } from "../lib/parseMarket";

const COOKIE_NAME = "piq_tour_session";
const STORAGE_KEY = "piq_tour";
const COOKIE_TTL_DAYS = 7;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function isSecureContext(): boolean {
  return (
    typeof window !== "undefined" && window.location?.protocol === "https:"
  );
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const expires = new Date(
    Date.now() + COOKIE_TTL_DAYS * 86400_000,
  ).toUTCString();
  const secure = isSecureContext() ? "; secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}; samesite=lax${secure}`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  const secure = isSecureContext() ? "; secure" : "";
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax${secure}`;
}

function loadFromStorage(): Partial<TourSession> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveToStorage(session: TourSession) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function mintSessionId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older jsdom, etc).
  return `tour-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useTourSession() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [session, setSession] = useState<TourSession>(() => {
    const resumeMode = searchParams?.get("resume");
    if (resumeMode === "fresh" && typeof window !== "undefined") {
      if (typeof localStorage !== "undefined")
        localStorage.removeItem(STORAGE_KEY);
      deleteCookie(COOKIE_NAME);
    }

    const stored = resumeMode === "fresh" ? {} : loadFromStorage();
    const cookieId = resumeMode === "fresh" ? null : readCookie(COOKIE_NAME);
    const sessionId = cookieId ?? stored.sessionId ?? mintSessionId();
    if (!cookieId) writeCookie(COOKIE_NAME, sessionId);

    const personaParam =
      (searchParams?.get("persona") as Persona | null) ?? null;
    const marketParam = parseMarketParam(searchParams?.get("market") ?? null);
    const phaseParam = (searchParams?.get("phase") as TourPhase | null) ?? null;

    // The `<geoLevel>-<geoId>` URL param carries no display name, so
    // parseMarket yields `name: ""`. When that same market was already chosen
    // (with its real name) via the picker and persisted, backfill the stored
    // name so a hard nav to a bare-URL market (e.g. ?market=metro-39580) keeps
    // the name instead of clobbering it with an empty string — which otherwise
    // 400s the report DTO and blanks the finale header.
    if (
      marketParam &&
      !marketParam.name &&
      stored.market &&
      stored.market.geoLevel === marketParam.geoLevel &&
      stored.market.geoId === marketParam.geoId &&
      stored.market.name
    ) {
      marketParam.name = stored.market.name;
    }

    const next: TourSession = {
      sessionId,
      persona: personaParam ?? stored.persona ?? null,
      market: marketParam ?? stored.market ?? null,
      phase:
        phaseParam ??
        (personaParam ? (marketParam ? "step1" : "market") : "persona"),
      reportId: stored.reportId ?? null,
      startedAt: stored.startedAt ?? Date.now(),
    };
    saveToStorage(next);
    return next;
  });

  useEffect(() => {
    saveToStorage(session);
  }, [session]);

  // Strip ?resume=fresh once state has been reset, so a refresh doesn't re-trigger.
  useEffect(() => {
    if (searchParams?.get("resume") === "fresh") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("resume");
      const queryStr = params.toString();
      router.replace(queryStr ? `${pathname}?${queryStr}` : pathname);
    }
    // Run only once on mount — by the time this fires, the lazy initializer above
    // has already cleared cookie/localStorage. We just need to clean up the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NOTE: router.replace must be called OUTSIDE the setSession updater function.
  // React 19 may invoke updater functions during render, and calling router methods
  // (which trigger Router setState) during render throws "Cannot update a component
  // while rendering a different component". State + URL sync is split into:
  //   1. Pure state update via setSession((prev) => next)
  //   2. router.replace as a normal side-effect after setSession returns
  // These callbacks run from event handlers, so reading session.market via closure
  // is safe (the post-render value is current at click time).
  const setPersona = useCallback(
    (persona: Persona) => {
      const nextPhase: TourPhase = session.market ? "step1" : "market";
      setSession((prev) => ({ ...prev, persona, phase: nextPhase }));
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("persona", persona);
      params.set("phase", nextPhase);
      router.replace(`${pathname}?${params}`);
    },
    [router, pathname, searchParams, session.market],
  );

  const setMarket = useCallback(
    (market: MarketRef) => {
      setSession((prev) => ({ ...prev, market, phase: "step1" }));
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("market", `${market.geoLevel}-${market.geoId}`);
      params.set("phase", "step1");
      router.replace(`${pathname}?${params}`);
    },
    [router, pathname, searchParams],
  );

  const advanceTo = useCallback(
    (phase: TourPhase) => {
      setSession((prev) => ({ ...prev, phase }));
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("phase", phase);
      router.replace(`${pathname}?${params}`);
    },
    [router, pathname, searchParams],
  );

  const reset = useCallback(() => {
    if (typeof localStorage !== "undefined")
      localStorage.removeItem(STORAGE_KEY);
    deleteCookie(COOKIE_NAME);
    setSession({
      sessionId: mintSessionId(),
      persona: null,
      market: null,
      phase: "persona",
      reportId: null,
      startedAt: Date.now(),
    });
  }, []);

  return useMemo(
    () => ({ session, setPersona, setMarket, advanceTo, reset }),
    [session, setPersona, setMarket, advanceTo, reset],
  );
}
