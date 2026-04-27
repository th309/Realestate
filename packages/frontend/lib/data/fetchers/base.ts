/**
 * BASE FETCHER UTILITIES
 *
 * Core fetching infrastructure used by all data fetchers.
 * Automatically includes Supabase JWT auth headers when available.
 */

import { getAuthHeaders } from "./auth-headers";

/**
 * Default API origin when NEXT_PUBLIC_API_URL was not set at build time.
 * Production builds must still set NEXT_PUBLIC_API_URL explicitly when the API host changes.
 *
 * Without this, the client bundle falls back to localhost — which breaks deployed sites
 * (browser tries each user's own machine, producing "Failed to fetch").
 */
const DEFAULT_PRODUCTION_API_URL =
  "https://backend-production-ee4d.up.railway.app";

function resolveApiUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    return DEFAULT_PRODUCTION_API_URL;
  }
  return "http://localhost:3001";
}

/**
 * API base URL — uses NEXT_PUBLIC_API_URL, then production default, then localhost (dev).
 */
export const API_URL = resolveApiUrl();

/**
 * Content-pipeline admin calls must share one routing strategy (CLAUDE §1.0): either
 * all go through the Next.js `/api/admin/content-pipeline/*` proxy (browser, same-origin)
 * or all go straight to Nest (SSR / server). Mixing only `fetchAPIRaw` broke other
 * callers still using `fetchAPI` cross-origin.
 */
function resolveContentPipelineAdminFetchUrl(endpoint: string): string {
  const pipelineAdmin = endpoint.startsWith("/api/admin/content-pipeline");
  if (
    typeof window !== "undefined" &&
    pipelineAdmin
  ) {
    return new URL(endpoint, window.location.origin).toString();
  }
  return `${API_URL}${endpoint}`;
}

/**
 * Generic fetch wrapper with error handling and retry for transient failures.
 * Retries once on 5xx or network errors with a 500ms delay.
 */
export async function fetchAPI<T>(endpoint: string): Promise<T> {
  const url = resolveContentPipelineAdminFetchUrl(endpoint);
  const maxRetries = 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const authHeaders = await getAuthHeaders();
    try {
      const response = await fetch(url, {
        credentials: "include",
        headers: { ...authHeaders },
      });

      if (response.status >= 500 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      // Aborted requests (HMR rebuild, navigation) — don't retry or warn
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      if (error instanceof TypeError && error.message === "Failed to fetch") {
        if (attempt < maxRetries) {
          console.warn(`[fetchAPI] Network error for ${endpoint}, retrying...`);
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
          continue;
        }
        console.warn(
          `[fetchAPI] Network error for ${endpoint} - backend may be unreachable`,
        );
      }
      throw error;
    }
  }

  throw new Error(
    `[fetchAPI] Failed after ${maxRetries + 1} attempts: ${endpoint}`,
  );
}

/**
 * Fetch with optional query parameters and retry for transient failures.
 */
export async function fetchAPIWithParams<T>(
  endpoint: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(resolveContentPipelineAdminFetchUrl(endpoint));

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const maxRetries = 1;
  const urlStr = url.toString();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const authHeaders = await getAuthHeaders();
    try {
      const response = await fetch(urlStr, {
        credentials: "include",
        cache: "no-store",
        headers: { ...authHeaders },
      });

      if (response.status >= 500 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      // Aborted requests (HMR rebuild, navigation) — don't retry
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      if (attempt < maxRetries && error instanceof TypeError) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `[fetchAPIWithParams] Failed after ${maxRetries + 1} attempts: ${endpoint}`,
  );
}

/**
 * Fetch with automatic retry for transient 5xx errors.
 * Includes auth headers and exponential backoff.
 * Returns the Response object for callers that need custom response handling.
 */
export async function fetchWithRetry(
  url: string,
  maxRetries = 2,
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        credentials: "include",
        headers: { ...authHeaders },
      });

      // Only retry on 5xx server errors
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = 500 * Math.pow(2, attempt); // 500ms, 1000ms
        console.warn(
          `[fetchWithRetry] ${response.status} from ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      // Aborted requests (HMR rebuild, navigation) — don't retry
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = 500 * Math.pow(2, attempt);
        console.warn(
          `[fetchWithRetry] Network error for ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw (
    lastError ??
    new Error(`Failed to fetch ${url} after ${maxRetries + 1} attempts`)
  );
}

/**
 * Raw fetch wrapper — returns the Response object for callers that need
 * custom error handling (e.g. admin pages that inspect status codes or
 * parse error bodies differently).
 *
 * All fetch traffic still routes through the data layer.
 */
export async function fetchAPIRaw(
  endpoint: string,
  init?: RequestInit,
): Promise<Response> {
  const url = resolveContentPipelineAdminFetchUrl(endpoint);
  const authHeaders = await getAuthHeaders();
  return fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      ...authHeaders,
      ...init?.headers,
    },
  });
}
