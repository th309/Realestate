import { AsyncLocalStorage } from "node:async_hooks";

export interface SessionAuth {
  userId: string;
}

export const authStore = new AsyncLocalStorage<SessionAuth>();

/** Get the current request's auth context */
export function getSessionAuth(): SessionAuth | null {
  return authStore.getStore() ?? null;
}
