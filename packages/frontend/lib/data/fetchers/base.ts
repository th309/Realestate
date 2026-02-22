/**
 * BASE FETCHER UTILITIES
 *
 * Core fetching infrastructure used by all data fetchers.
 * Automatically includes Supabase JWT auth headers when available.
 */

import { getAuthHeaders } from './auth-headers';

/**
 * API base URL - uses environment variable or falls back to localhost for development
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Generic fetch wrapper with error handling
 */
export async function fetchAPI<T>(endpoint: string): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const authHeaders = await getAuthHeaders();
  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: { ...authHeaders },
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    // Provide more context for debugging
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.warn(`[fetchAPI] Network error for ${endpoint} - backend may be unreachable`);
    }
    throw error;
  }
}

/**
 * Fetch with optional query parameters
 */
export async function fetchAPIWithParams<T>(
  endpoint: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const url = new URL(`${API_URL}${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const authHeaders = await getAuthHeaders();
  const response = await fetch(url.toString(), {
    credentials: 'include',
    headers: { ...authHeaders },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
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
        credentials: 'include',
        headers: { ...authHeaders },
      });

      // Only retry on 5xx server errors
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = 500 * Math.pow(2, attempt); // 500ms, 1000ms
        console.warn(`[fetchWithRetry] ${response.status} from ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = 500 * Math.pow(2, attempt);
        console.warn(`[fetchWithRetry] Network error for ${url}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url} after ${maxRetries + 1} attempts`);
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
  const url = `${API_URL}${endpoint}`;
  const authHeaders = await getAuthHeaders();
  return fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      ...authHeaders,
      ...init?.headers,
    },
  });
}
