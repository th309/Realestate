/** HTTP client wrapper for the PropertyIQ backend API */

import { config } from "./config";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch data from the PropertyIQ backend API.
 * Strips the `success` wrapper and returns the payload directly.
 */
export async function fetchApi<T = unknown>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(path, config.apiUrl);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(url.toString(), {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiError(
        response.status,
        `API returned ${response.status}: ${await response.text()}`,
      );
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ApiError(408, "Backend request timed out");
    }
    throw new ApiError(503, `Backend unreachable: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}
