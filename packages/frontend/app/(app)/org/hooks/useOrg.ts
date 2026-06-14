"use client";

import { createContext, useContext } from "react";

export interface OrgContextValue {
  org: {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    seat_limit: number;
    website_url: string | null;
    billing_status: string;
    created_at: string;
    updated_at: string;
  } | null;
  role: "admin" | "member" | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const OrgContext = createContext<OrgContextValue | null>(null);

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error("useOrg must be used within an OrgContextProvider");
  }
  return ctx;
}
