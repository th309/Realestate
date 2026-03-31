/** PropertyIQ MCP Server Configuration */

import { getApiKey } from "./auth";

export const config = {
  apiUrl:
    process.env.PROPERTYIQ_API_URL ||
    "https://backend-production-ee4d.up.railway.app",
  timeout: 15_000,
  defaultLimit: 25,
  maxLimit: 100,
  apiKey: null as string | null,
};

export function resolveApiKey(): string | null {
  config.apiKey = getApiKey();
  return config.apiKey;
}
