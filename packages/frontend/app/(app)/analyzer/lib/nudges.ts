export type NudgeResult = { level: "ok" | "warn"; text: string } | null;

/**
 * Nudges flag inputs that fall outside a healthy range and explain why.
 * Pure functions — no side effects.
 */

export function nudgeForPrice(price: number): NudgeResult {
  if (price <= 0)
    return { level: "warn", text: "Price must be greater than $0" };
  if (price < 30_000)
    return {
      level: "warn",
      text: "Very low price — verify it's a real listing, not a tax-sale lot",
    };
  if (price > 5_000_000)
    return {
      level: "warn",
      text: "$5M+ — confirm this is residential and your financing supports it",
    };
  return null;
}

export function nudgeForRent(rentMonthly: number, price: number): NudgeResult {
  if (rentMonthly <= 0)
    return { level: "warn", text: "Rent must be greater than $0" };
  // The 1% rule is a MONTHLY ratio: monthly rent ÷ price should be ≥ 1%.
  // Previous version computed the annual yield (rent × 12 / price) and
  // displayed it next to a "1% rule" comparison, which made the percent and
  // the label talk past each other (e.g. "5.8% — far below 1% rule").
  const monthlyRatio = rentMonthly / price;
  if (monthlyRatio >= 0.01)
    return {
      level: "ok",
      text: `Rent-to-price ${(monthlyRatio * 100).toFixed(2)}% — meets the 1% rule`,
    };
  if (monthlyRatio < 0.005)
    return {
      level: "warn",
      text: `Rent-to-price ${(monthlyRatio * 100).toFixed(2)}% — far below 1% rule; verify rent`,
    };
  return null;
}

export function nudgeForTax(taxAnnual: number, price: number): NudgeResult {
  const ratio = taxAnnual / price;
  if (ratio > 0.025)
    return {
      level: "warn",
      text: `Tax ${(ratio * 100).toFixed(2)}% of price — high; check assessor / millage`,
    };
  if (ratio === 0)
    return {
      level: "warn",
      text: "Tax = 0 — confirm; missing tax data understates expenses",
    };
  return null;
}

export function nudgeForInsurance(
  insuranceAnnual: number,
  price: number,
): NudgeResult {
  const ratio = insuranceAnnual / price;
  if (ratio > 0.015)
    return {
      level: "warn",
      text: `Insurance ${(ratio * 100).toFixed(2)}% of price — high; FL/coastal?`,
    };
  if (insuranceAnnual === 0)
    return {
      level: "warn",
      text: "Insurance = 0 — get an actual quote, not a placeholder",
    };
  return null;
}

export function nudgeForHOA(
  hoaMonthly: number,
  rentMonthly: number,
): NudgeResult {
  if (rentMonthly <= 0) return null;
  const ratio = hoaMonthly / rentMonthly;
  if (ratio > 0.25)
    return {
      level: "warn",
      text: `HOA = ${(ratio * 100).toFixed(0)}% of rent — eats cashflow`,
    };
  return null;
}

export function nudgeForVacancy(vacancyPct: number): NudgeResult {
  if (vacancyPct < 0.03)
    return {
      level: "warn",
      text: "Vacancy < 3% — too optimistic; use 5–8% for typical SFR",
    };
  if (vacancyPct > 0.12)
    return {
      level: "warn",
      text: "Vacancy > 12% — pessimistic for a stable market",
    };
  return null;
}

export function nudgeForMaintenance(maintenancePct: number): NudgeResult {
  if (maintenancePct < 0.05)
    return {
      level: "warn",
      text: "Maintenance < 5% — unrealistic for older homes; use 8–10%",
    };
  return null;
}

export function nudgeForManagement(managementPct: number): NudgeResult {
  if (managementPct === 0)
    return {
      level: "ok",
      text: "Self-managing — own the time cost; budget at least 8% if you scale",
    };
  if (managementPct > 0.12)
    return { level: "warn", text: "Management > 12% — high; comp local PMs" };
  return null;
}

export function nudgeForDownPayment(downPct: number): NudgeResult {
  if (downPct < 0.1)
    return {
      level: "warn",
      text: `Down ${(downPct * 100).toFixed(0)}% — most investor loans require ≥20–25%`,
    };
  if (downPct > 0.5)
    return {
      level: "ok",
      text: `Down ${(downPct * 100).toFixed(0)}% — heavy equity, low leverage; lower IRR but lower risk`,
    };
  return null;
}

export function nudgeForRate(ratePct: number): NudgeResult {
  if (ratePct < 4)
    return {
      level: "warn",
      text: `Rate ${ratePct.toFixed(1)}% — below current market; verify the lock`,
    };
  if (ratePct > 12)
    return {
      level: "warn",
      text: `Rate ${ratePct.toFixed(1)}% — hard-money territory; not for buy-and-hold`,
    };
  return null;
}

export function nudgeForTerm(termYears: number): NudgeResult {
  if (termYears < 15)
    return {
      level: "warn",
      text: `${termYears}-yr term — high payments; verify cashflow`,
    };
  if (termYears > 40)
    return {
      level: "warn",
      text: `${termYears}-yr term — atypical; confirm with lender`,
    };
  return null;
}

export function nudgeForClosingCosts(closingPct: number): NudgeResult {
  if (closingPct < 0.015)
    return {
      level: "warn",
      text: "Closing < 1.5% — likely missing items; budget 2–4%",
    };
  return null;
}

export function nudgeForArv(arv: number, price: number): NudgeResult {
  if (arv <= price)
    return {
      level: "warn",
      text: "ARV ≤ price — no value-add path; not a flip/BRRRR",
    };
  const margin = (arv - price) / arv;
  if (margin < 0.15)
    return {
      level: "warn",
      text: `ARV margin ${(margin * 100).toFixed(0)}% — thin; below 70% rule`,
    };
  return null;
}

export function nudgeForRehab(rehabBudget: number, arv: number): NudgeResult {
  const ratio = rehabBudget / arv;
  if (ratio > 0.3)
    return {
      level: "warn",
      text: `Rehab = ${(ratio * 100).toFixed(0)}% of ARV — heavy; full reno budget`,
    };
  if (rehabBudget === 0)
    return { level: "warn", text: "Rehab budget = 0 — likely missing scope" };
  return null;
}

export function nudgeForRefiLTV(ltvPct: number): NudgeResult {
  if (ltvPct > 0.8)
    return {
      level: "warn",
      text: `Refi LTV ${(ltvPct * 100).toFixed(0)}% — most cash-out caps at 75–80%`,
    };
  return null;
}
