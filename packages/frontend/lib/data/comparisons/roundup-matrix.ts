/**
 * Feature matrix for the /compare ranking chart: features down the rows, tools
 * across the columns in rank order. Cells are honest as of June 2026 (sourced
 * from the 2026-06-10 competitor deep-dive). Keyed by tool name so the renderer
 * can iterate ROUNDUP_TOOLS (rank order) and look up each cell.
 *
 * Split out of roundup.ts to stay within file size limits (CLAUDE.md §1.3).
 */

export type MatrixCell = "yes" | "partial" | "no";

export interface MatrixRow {
  feature: string;
  cells: Record<string, MatrixCell>;
}

export const ROUNDUP_MATRIX: MatrixRow[] = [
  {
    feature: "Proprietary market score",
    cells: {
      PropertyIQ: "yes",
      "Reventure App": "yes",
      DealCheck: "no",
      BiggerPockets: "partial",
      Mashvisor: "yes",
      PropStream: "no",
    },
  },
  {
    feature: "County + ZIP-level data",
    cells: {
      PropertyIQ: "yes",
      "Reventure App": "yes",
      DealCheck: "no",
      BiggerPockets: "no",
      Mashvisor: "partial",
      PropStream: "no",
    },
  },
  {
    feature: "Published methodology + backtest",
    cells: {
      PropertyIQ: "yes",
      "Reventure App": "no",
      DealCheck: "no",
      BiggerPockets: "no",
      Mashvisor: "no",
      PropStream: "no",
    },
  },
  {
    feature: "Data-quality confidence grade",
    cells: {
      PropertyIQ: "yes",
      "Reventure App": "no",
      DealCheck: "no",
      BiggerPockets: "no",
      Mashvisor: "no",
      PropStream: "no",
    },
  },
  {
    feature: "Monthly data refresh",
    cells: {
      PropertyIQ: "yes",
      "Reventure App": "yes",
      DealCheck: "partial",
      BiggerPockets: "no",
      Mashvisor: "partial",
      PropStream: "partial",
    },
  },
  {
    feature: "AI market reports",
    cells: {
      PropertyIQ: "yes",
      "Reventure App": "no",
      DealCheck: "no",
      BiggerPockets: "no",
      Mashvisor: "no",
      PropStream: "no",
    },
  },
  {
    feature: "Claude / AI assistant (MCP)",
    cells: {
      PropertyIQ: "yes",
      "Reventure App": "no",
      DealCheck: "no",
      BiggerPockets: "no",
      Mashvisor: "no",
      PropStream: "partial",
    },
  },
  {
    feature: "Built-in deal analyzer",
    cells: {
      PropertyIQ: "yes",
      "Reventure App": "partial",
      DealCheck: "yes",
      BiggerPockets: "yes",
      Mashvisor: "yes",
      PropStream: "partial",
    },
  },
  {
    feature: "Short-term rental (Airbnb) data",
    cells: {
      PropertyIQ: "no",
      "Reventure App": "no",
      DealCheck: "partial",
      BiggerPockets: "no",
      Mashvisor: "yes",
      PropStream: "no",
    },
  },
  {
    feature: "Free tier",
    cells: {
      PropertyIQ: "yes",
      "Reventure App": "partial",
      DealCheck: "yes",
      BiggerPockets: "yes",
      Mashvisor: "no",
      PropStream: "no",
    },
  },
  {
    feature: "Mobile app",
    cells: {
      PropertyIQ: "no",
      "Reventure App": "yes",
      DealCheck: "yes",
      BiggerPockets: "partial",
      Mashvisor: "partial",
      PropStream: "yes",
    },
  },
];
