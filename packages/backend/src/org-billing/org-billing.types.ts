/**
 * Types for the organization billing module.
 *
 * Field names use snake_case to match the frontend API contract.
 */

export interface OrgUsageResponse {
  seats_included: number;
  additional_seats: number;
  seats_used: number;
  pending_invites: number;
  plan_name: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  upcoming_invoice: UpcomingInvoiceSummary | null;
}

export interface UpcomingInvoiceSummary {
  amount_due: number;
  currency: string;
  period_end: string;
}

export interface OrgCheckoutParams {
  orgName: string;
  orgSlug: string;
  ownerEmail: string;
  ownerId: string;
}
