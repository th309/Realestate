"use client";
import { createContext, useContext, useState, ReactNode } from "react";

export type Mode = "pro" | "present" | "pdf";

const ModeCtx = createContext<{
  mode: Mode;
  setMode: (m: Mode) => void;
} | null>(null);

export function ModeProvider({
  children,
  initial = "pro",
}: {
  children: ReactNode;
  initial?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initial);
  return (
    <ModeCtx.Provider value={{ mode, setMode }}>{children}</ModeCtx.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeCtx);
  if (!ctx) throw new Error("useMode outside ModeProvider");
  return ctx;
}
