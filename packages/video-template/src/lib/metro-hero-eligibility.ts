import top200 from "../data/metro-population-top-200-cbsa.json";

const TOP_200 = new Set(top200 as string[]);

/** True if CBSA is in the population-derived top 200 (2023 Census CSV in repo). */
export function isMetroPopulationTop200(cbsaCode: string): boolean {
  return TOP_200.has(String(cbsaCode).trim());
}
