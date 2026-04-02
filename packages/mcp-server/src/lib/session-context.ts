import { AsyncLocalStorage } from "node:async_hooks";

export type SessionAuth =
  | { type: "api_key"; apiKey: string }
  | { type: "oauth"; userId: string };

export const authStore = new AsyncLocalStorage<SessionAuth>();

/** Get the current request's auth context */
export function getSessionAuth(): SessionAuth | null {
  return authStore.getStore() ?? null;
}

// ── Backwards-compatible helpers ──

/** @deprecated Use getSessionAuth() instead */
export const apiKeyStore = authStore;

export function getRequestApiKey(): string | null {
  const auth = authStore.getStore();
  if (!auth) return null;
  return auth.type === "api_key" ? auth.apiKey : null;
}
