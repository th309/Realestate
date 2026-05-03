import { API_URL } from "./base";

export type Persona = "agent" | "investor" | "homebuyer";

export interface MarketRef {
  geoLevel: "metro" | "county" | "city" | "zip";
  geoId: string;
  name: string;
}

export interface ReportSection {
  id: string;
  title: string;
  data: unknown;
  limitedData: boolean;
}

export interface AnonReportResponse {
  reportId: string;
  sessionId: string;
  watermark: string;
  expiresAt: string;
  claimable: boolean;
  report: { sections: ReportSection[] };
}

export class TourRateLimitError extends Error {
  retryAfter: number;
  signupUrl: string;
  constructor(retryAfter: number, signupUrl: string) {
    super("rate_limited");
    this.retryAfter = retryAfter;
    this.signupUrl = signupUrl;
  }
}

export async function generateAnonymousListingPresentation(input: {
  sessionId: string;
  persona: Persona;
  market: MarketRef;
}): Promise<AnonReportResponse> {
  const res = await fetch(`${API_URL}/api/anonymous/listing-presentation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    throw new TourRateLimitError(
      body.retryAfter ?? 86400,
      body.signupUrl ?? "/auth/sign-up",
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body?.error ? ` (${body.error})` : "";
    const err = new Error(
      `Anon listing presentation failed: ${res.status}${detail}`,
    );
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.json();
}
