import { DriverCost } from './driver-cost.types';

export type LeadMagnetKind =
  | 'market_snapshot_pdf'
  | 'top_50_cashflow_report'
  | 'movers_report'
  | 'market_comparison'
  | 'farm_area_audit'
  | 'brokerage_coverage_report'
  | 'agent_recruitment_kit'
  | 'long_form_companion';

export interface LeadMagnetRenderRequest {
  magnetKind: LeadMagnetKind;
  templatePath: string;
  dataBundle: unknown;
  userContext: { userName: string; email: string };
  outputPath: string;
}

export interface LeadMagnetRenderResult {
  pdfPath: string;
  pageCount: number;
  renderWallMs: number;
  cost: DriverCost;
}

export interface LeadMagnetRenderer {
  render(req: LeadMagnetRenderRequest): Promise<LeadMagnetRenderResult>;
}

export const LEAD_MAGNET_RENDERER = Symbol('LeadMagnetRenderer');
