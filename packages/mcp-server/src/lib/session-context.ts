/**
 * Per-request API key context using AsyncLocalStorage.
 *
 * Each HTTP request to the MCP server carries the user's Bearer token.
 * AsyncLocalStorage propagates it through the async call chain so
 * fetchApi() can pick it up without changing every tool handler signature.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export const apiKeyStore = new AsyncLocalStorage<string>();

/** Get the current request's API key (from AsyncLocalStorage or null). */
export function getRequestApiKey(): string | null {
  return apiKeyStore.getStore() ?? null;
}
