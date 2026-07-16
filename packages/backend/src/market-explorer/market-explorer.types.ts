export interface ScopeRegion {
  id: string;
  name: string;
  state: string;
  population: number | null;
  nearby?: boolean;
}

export interface ScopeSeriesResponse {
  success: true;
  geoLevel: string;
  months: number;
  dates: string[];
  regions: ScopeRegion[];
  series: Record<string, Record<string, (number | null)[]>>;
  /** Present only when the roster was capped below the true count (ZIP tier). */
  totalAvailable?: number;
}
