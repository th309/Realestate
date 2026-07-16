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
  metric: string;
  months: number;
  dates: string[];
  regions: ScopeRegion[];
  series: Record<string, (number | null)[]>;
}
