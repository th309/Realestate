/**
 * Rich snapshot type captured when a user clicks Share/PDF.
 *
 * Stored in the `deal_analyses.result_snapshot` JSONB column (a free-form
 * Record<string, unknown> on the backend). This file is the single source
 * of truth for what we store, so the save path and the read path stay in
 * sync. All fields are optional so the type also covers older "minimal"
 * snapshots that only had rental/flip/brrrr.
 */

import type {
  RentalResult,
  FlipResult,
  BrrrrResult,
} from "@propertyiq/analyzer-core";
import type { MarketContext } from "@/lib/data";

export interface RichResultSnapshot {
  // ─── analyzer-core outputs (already saved) ────────────
  rental?: Partial<RentalResult>;
  flip?: FlipResult | null;
  brrrr?: BrrrrResult | null;

  // ─── derived chart data ──────────────────────────────
  projection?: unknown;
  sensitivity?: unknown;
  afterTax?: unknown;
  breakEven?: unknown;
  brrrrTimeline?: unknown;
  expense?: {
    grossRentMonthly: number;
    vacancyMonthly: number;
    opexMonthly: number;
    debtServiceMonthly: number;
  };

  // ─── input echo (so we can render an Inputs table) ───
  input?: Record<string, unknown>;
  assumptions?: Record<string, unknown>;
  arvLocal?: number | null;
  rehabBudget?: number | null;
  propertyType?: string;
  unitCount?: number | null;
  propertyClass?: string;

  // ─── grading + recommendation ────────────────────────
  grading?: {
    letter: "A" | "B" | "C" | "D" | "F";
    label?: string;
    summary?: string;
    finalGpa?: number;
  };
  bestStrategy?: "buyAndHold" | "flip" | "brrrr";

  // ─── comps (for the comps section + static map) ──────
  comps?: {
    salesComps?: Array<{
      address?: string;
      lat?: number | null;
      lon?: number | null;
      price?: number | null;
      beds?: number | null;
      sqft?: number | null;
      distance?: number;
    }>;
    pricePerSqftValues?: number[];
    yourPricePerSqft?: number;
    subjectPrice?: number;
    subjectLat?: number | null;
    subjectLon?: number | null;
  };

  // ─── market context echo (alternate location) ───────
  marketContext?: MarketContext | Record<string, unknown> | null;

  // ─── user notes ──────────────────────────────────────
  // `notes` is the free-text the owner typed in the "My Notes" section.
  // `shareNotes` gates whether those notes are surfaced on the public
  // share link / PDF (the "Share with client" checkbox). Private notes are
  // still stored either way (so they reload on the owner's saved page); the
  // readonly share view only renders them when `shareNotes === true`.
  notes?: string;
  shareNotes?: boolean;

  // ─── AI narratives (pre-awaited before save) ────────
  aiNarratives?: {
    recommendation_analysis?: string | null;
    projection?: string | null;
    expense_waterfall?: string | null;
    sensitivity?: string | null;
    comps?: string | null;
    after_tax?: string | null;
    market_context?: string | null;
  };
}
