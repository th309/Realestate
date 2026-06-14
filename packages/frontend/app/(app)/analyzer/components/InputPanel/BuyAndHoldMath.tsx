"use client";

import type { DealInput, RentalResult } from "@propertyiq/analyzer-core";
import {
  MathSection,
  Row,
  Total,
  fmtPct,
  fmtRatio,
  fmtUsd,
} from "./MetricMathPrimitives";

export function BuyAndHoldMath({
  input,
  rental,
}: {
  input: DealInput;
  rental: RentalResult;
}) {
  const grossRentAnnual = (input.rentMonthly ?? 0) * 12;
  const vacancyPct = input.vacancyPctOfRent ?? 0.05;
  const maintenancePct = input.maintenancePctOfRent ?? 0.08;
  const managementPct = input.managementPctOfRent ?? 0.08;
  const vacancyDollars = grossRentAnnual * vacancyPct;
  const maintenanceDollars = grossRentAnnual * maintenancePct;
  const managementDollars = grossRentAnnual * managementPct;
  const hoaAnnual = (input.hoaMonthly ?? 0) * 12;
  const taxAnnual = input.taxAnnual ?? 0;
  const insuranceAnnual = input.insuranceAnnual ?? 0;
  const opex =
    taxAnnual +
    insuranceAnnual +
    hoaAnnual +
    maintenanceDollars +
    managementDollars;

  const noi = rental.noiAnnual ?? 0;
  const annualDS = rental.monthlyDebtService * 12;
  const annualCF = (rental.cashflowMonthly ?? 0) * 12;
  const cashInvested = rental.totalCashInvested;

  const dscr = rental.dscr ?? 0;
  const capRate = (rental.capRatePct ?? 0) / 100;
  const cashOnCash = (rental.cashOnCashPct ?? 0) / 100;
  const beOcc = grossRentAnnual > 0 ? (opex + annualDS) / grossRentAnnual : 0;

  return (
    <>
      <MathSection title="Income">
        <Row label="Monthly rent" value={fmtUsd(input.rentMonthly ?? 0)} />
        <Row label="× 12" value={fmtUsd(grossRentAnnual)} indent />
        <Row
          label={`− Vacancy (${(vacancyPct * 100).toFixed(0)}%)`}
          value={`−${fmtUsd(vacancyDollars)}`}
        />
        <Total
          label="= Effective gross rent"
          value={fmtUsd(grossRentAnnual - vacancyDollars)}
        />
      </MathSection>

      <MathSection title="Operating Expenses">
        <Row label="Property tax" value={fmtUsd(taxAnnual)} />
        <Row label="Insurance" value={fmtUsd(insuranceAnnual)} />
        {hoaAnnual > 0 && <Row label="HOA (× 12)" value={fmtUsd(hoaAnnual)} />}
        <Row
          label={`Maintenance (${(maintenancePct * 100).toFixed(0)}% of rent)`}
          value={fmtUsd(maintenanceDollars)}
        />
        <Row
          label={`Management (${(managementPct * 100).toFixed(0)}% of rent)`}
          value={fmtUsd(managementDollars)}
        />
        <Total label="= Total opex" value={fmtUsd(opex)} />
      </MathSection>

      <MathSection title="NOI = Effective gross − Opex">
        <Total label="= NOI" value={fmtUsd(noi)} />
      </MathSection>

      <MathSection title="Financing">
        <Row label="Monthly P&I" value={fmtUsd(rental.monthlyDebtService)} />
        <Row label="× 12" value={fmtUsd(annualDS)} indent />
        <Total label="= Annual debt service" value={fmtUsd(annualDS)} />
      </MathSection>

      <MathSection title="Cash Flow">
        <Row label="NOI" value={fmtUsd(noi)} />
        <Row label="− Annual debt service" value={`−${fmtUsd(annualDS)}`} />
        <Total label="= Annual cash flow" value={fmtUsd(annualCF)} />
      </MathSection>

      <MathSection title="Metrics">
        <Row
          label={`Cap rate = NOI ÷ Price = ${fmtUsd(noi)} ÷ ${fmtUsd(input.price)}`}
          value={fmtPct(capRate)}
        />
        <Row
          label={`DSCR = NOI ÷ Debt service = ${fmtUsd(noi)} ÷ ${fmtUsd(annualDS)}`}
          value={fmtRatio(dscr)}
        />
        <Row
          label={`Cash-on-Cash = Cash flow ÷ Cash invested = ${fmtUsd(annualCF)} ÷ ${fmtUsd(cashInvested)}`}
          value={fmtPct(cashOnCash)}
        />
        <Row
          label={`Break-even occ = (Opex + DS) ÷ Gross rent`}
          value={fmtPct(beOcc)}
        />
      </MathSection>
    </>
  );
}
