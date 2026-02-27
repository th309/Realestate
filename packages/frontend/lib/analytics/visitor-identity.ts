/**
 * Persistent visitor identity using localStorage.
 * Survives across browser sessions for cross-session attribution.
 * DATA LAYER EXEMPTION: Analytics identity, not data fetching.
 */
const VISITOR_KEY = "piq-visitor-id";

export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let visitorId = localStorage.getItem(VISITOR_KEY);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, visitorId);
  }
  return visitorId;
}
