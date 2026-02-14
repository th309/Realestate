/**
 * BASE FETCHER UTILITIES
 *
 * Core fetching infrastructure used by all data fetchers.
 */

/**
 * API base URL - uses environment variable or falls back to localhost for development
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Generic fetch wrapper with error handling
 */
export async function fetchAPI<T>(endpoint: string): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      credentials: 'include',
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

  const response = await fetch(url.toString(), {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}
