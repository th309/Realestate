import { fmtPct, fmtUsd } from "@/app/analyzer/lib/format-helpers";

interface FinancingLite {
  downPaymentPct?: number | null; // fraction (0.2 = 20%)
  interestRatePct?: number | null; // percentage (7.1 = 7.1%)
  termYears?: number | null;
}

interface DealInputLite {
  price?: number | null;
  rentMonthly?: number | null;
  taxAnnual?: number | null;
  insuranceAnnual?: number | null;
  hoaMonthly?: number | null;
  maintenancePctOfRent?: number | null;
  vacancyPctOfRent?: number | null;
  managementPctOfRent?: number | null;
  financing?: FinancingLite | null;
}

interface ExpenseLite {
  opexMonthly?: number | null;
  debtServiceMonthly?: number | null;
}

interface Props {
  input: DealInputLite;
  /** Computed expense rollup — gives us OpEx (sum of components). */
  expense?: ExpenseLite;
  arvLocal?: number | null;
  rehabBudget?: number | null;
  propertyClass?: string | null;
}

/**
 * Tabular inputs summary for the cover page. Investment-memo style:
 * 4-col key/value grid (two key/value pairs side-by-side per row), no card
 * backgrounds, hairline rules only. The cheapest single move that makes
 * the PDF feel like a document.
 *
 * Field shapes (per analyzer-core DealInput):
 *   - `financing.downPaymentPct` is a FRACTION (0.2 = 20%)
 *   - `financing.interestRatePct` is a PERCENTAGE (7.1 = 7.1%)
 *   - `vacancyPctOfRent` etc. are FRACTIONS (0.05 = 5%)
 */
export function InputsTable({
  input,
  expense,
  arvLocal,
  rehabBudget,
  propertyClass,
}: Props) {
  const financing = input.financing ?? {};

  const left: Array<[string, string]> = [
    ["Purchase price", fmtUsd(input.price ?? null)],
    ["Down payment", fmtPct(financing.downPaymentPct ?? null)],
    [
      "Interest rate",
      fmtPct(
        financing.interestRatePct != null
          ? financing.interestRatePct / 100
          : null,
      ),
    ],
    [
      "Loan term",
      financing.termYears != null ? `${financing.termYears} yrs` : "—",
    ],
    ["ARV", arvLocal != null && arvLocal > 0 ? fmtUsd(arvLocal) : "—"],
  ];

  const right: Array<[string, string]> = [
    [
      "Rent (monthly)",
      input.rentMonthly != null ? fmtUsd(input.rentMonthly) + "/mo" : "—",
    ],
    ["Vacancy", fmtPct(input.vacancyPctOfRent ?? null)],
    [
      "OpEx (monthly)",
      expense?.opexMonthly != null ? fmtUsd(expense.opexMonthly) + "/mo" : "—",
    ],
    [
      "Rehab budget",
      rehabBudget != null && rehabBudget > 0 ? fmtUsd(rehabBudget) : "—",
    ],
    ["Property class", classLabel(propertyClass)],
  ];

  return (
    <table className="pdf-table">
      <thead>
        <tr>
          <th style={{ width: "30%" }}>Inputs</th>
          <th style={{ width: "20%" }} />
          <th style={{ width: "30%" }} />
          <th style={{ width: "20%" }} />
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: Math.max(left.length, right.length) }).map(
          (_, i) => (
            <tr key={i}>
              <td className="label">{left[i]?.[0] ?? ""}</td>
              <td>{left[i]?.[1] ?? ""}</td>
              <td className="label">{right[i]?.[0] ?? ""}</td>
              <td>{right[i]?.[1] ?? ""}</td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

function classLabel(c: string | null | undefined): string {
  switch (c) {
    case "sfh":
      return "Single-family";
    case "small_mf":
      return "Small multifamily";
    case "commercial_mf":
      return "Commercial MF";
    default:
      return "—";
  }
}
