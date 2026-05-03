"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { MarketRef, Persona, TourPhase, TourSession } from "../types";

const COOKIE_NAME = "piq_tour_session";
const STORAGE_KEY = "piq_tour";
const COOKIE_TTL_DAYS = 7;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const expires = new Date(
    Date.now() + COOKIE_TTL_DAYS * 86400_000,
  ).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}; samesite=lax`;
}

function parseMarketParam(raw: string | null): MarketRef | null {
  if (!raw) return null;
  // Format: "<geoLevel>-<geoId>" e.g. "metro-39580" or "cbsa-39580" (resolved later).
  const m = raw.match(/^([a-z]+)-(.+)$/);
  if (!m) return null;
  return { geoLevel: m[1] as MarketRef["geoLevel"], geoId: m[2], name: "" };
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
    const stored = loadFromStorage();
    const cookieId = readCookie(COOKIE_NAME);
    const sessionId = cookieId ?? stored.sessionId ?? mintSessionId();
    if (!cookieId) writeCookie(COOKIE_NAME, sessionId);

    const personaParam =
      (searchParams?.get("persona") as Persona | null) ?? null;
    const marketParam = parseMarketParam(searchParams?.get("market") ?? null);
    const phaseParam = (searchParams?.get("phase") as TourPhase | null) ?? null;

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

  const setPersona = useCallback(
    (persona: Persona) => {
      setSession((prev) => {
        const nextPhase: TourPhase = prev.market ? "step1" : "market";
        const next: TourSession = { ...prev, persona, phase: nextPhase };
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.set("persona", persona);
        params.set("phase", nextPhase);
        router.replace(`${pathname}?${params}`);
        return next;
      });
    },
    [router, pathname, searchParams],
  );

  const setMarket = useCallback(
    (market: MarketRef) => {
      setSession((prev) => {
        const next: TourSession = { ...prev, market, phase: "step1" };
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.set("market", `${market.geoLevel}-${market.geoId}`);
        params.set("phase", "step1");
        router.replace(`${pathname}?${params}`);
        return next;
      });
    },
    [router, pathname, searchParams],
  );

  const advanceTo = useCallback(
    (phase: TourPhase) => {
      setSession((prev) => {
        const next: TourSession = { ...prev, phase };
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.set("phase", phase);
        router.replace(`${pathname}?${params}`);
        return next;
      });
    },
    [router, pathname, searchParams],
  );

  const reset = useCallback(() => {
    if (typeof localStorage !== "undefined")
      localStorage.removeItem(STORAGE_KEY);
    if (typeof document !== "undefined") {
      document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
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
