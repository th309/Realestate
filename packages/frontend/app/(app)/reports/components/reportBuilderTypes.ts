// Shared types for the report-builder page (market selection + generation flow).
// Kept in its own module so the page container, MarketSelector, and feedback
// components reference a single `Market` shape.

export interface Market {
  id: string;
  name: string;
  type: "metro" | "city" | "zip" | "county" | "state";
  center?: [number, number];
  state?: string;
}
