"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useTourSession } from "./hooks/useTourSession";

type TourContextValue = ReturnType<typeof useTourSession>;

const TourContext = createContext<TourContextValue | null>(null);

export function TourStateProvider({ children }: { children: ReactNode }) {
  const value = useTourSession();
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within <TourStateProvider>");
  return ctx;
}
