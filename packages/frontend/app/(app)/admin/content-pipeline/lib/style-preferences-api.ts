import { fetchAPI, fetchAPIRaw } from "@/lib/data/fetchers/base";
import type { StylePreferences } from "./style-preferences";

export type { SavedStyleRef, StylePreferences } from "./style-preferences";
export { STRENGTH_STEPS, strengthStepFor } from "./style-preferences";

const BASE = "/api/admin/content-pipeline/style-preferences";

export async function fetchStylePreferences(): Promise<StylePreferences> {
  const res = await fetchAPI<{ data: StylePreferences }>(BASE);
  return res.data;
}

async function mutate(
  url: string,
  init: RequestInit,
  what: string,
): Promise<StylePreferences> {
  const res = await fetchAPIRaw(url, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${what} failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { data: StylePreferences };
  return json.data;
}

/** Start using a style reference to steer generation. */
export async function saveStylePreference(
  styleReferenceId: string,
): Promise<StylePreferences> {
  return mutate(
    `${BASE}/saved/${styleReferenceId}`,
    { method: "POST" },
    "saveStylePreference",
  );
}

/** Stop using a style reference to steer generation. */
export async function unsaveStylePreference(
  styleReferenceId: string,
): Promise<StylePreferences> {
  return mutate(
    `${BASE}/saved/${styleReferenceId}`,
    { method: "DELETE" },
    "unsaveStylePreference",
  );
}

/** Set how strongly the saved styles steer generation. */
export async function setStyleSignalWeight(
  signalWeight: number,
): Promise<StylePreferences> {
  return mutate(
    BASE,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signalWeight }),
    },
    "setStyleSignalWeight",
  );
}
