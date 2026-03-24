/**
 * Types for the organization billing module.
 */

export interface OrgUsageResponse {
  seatLimit: number;
  extraSeats: number;
  activeMembers: number;
  pendingInvites: number;
  billingStatus: string;
  upcomingInvoice: UpcomingInvoiceSummary | null;
}

export interface UpcomingInvoiceSummary {
  amountDue: number;
  currency: string;
  periodEnd: string;
}

export interface OrgCheckoutParams {
  orgName: string;
  orgSlug: string;
  ownerEmail: string;
  ownerId: string;
}
