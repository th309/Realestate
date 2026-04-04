/** HTTP client wrapper for the PropertyIQ backend API */

import { config } from "./config";
import { getSessionAuth } from "./session-context";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const auth = getSessionAuth();
  if (auth) {
    headers["x-user-id"] = auth.userId;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(url.toString(), {
      headers,
      signal: controller.signal,
    });

    if (response.status === 401) {
      throw new ApiError(401, "Access token is invalid or expired.");
    }

    if (response.status === 403) {
      const body = await response.text();
      throw new ApiError(
        403,
        `Access denied: ${body}. Visit https://propertyiq.up.railway.app/pricing to upgrade.`,
      );
    }

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
