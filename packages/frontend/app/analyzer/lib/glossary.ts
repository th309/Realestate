export interface GlossaryEntry {
  name: string;
  formula: string;
  plain: string;
  whyMatters: string;
}

export type GlossaryKey =
  | "cap_rate"
  | "coc"
  | "dscr"
  | "noi"
  | "cashflow"
  | "irr"
  | "one_pct_rule"
  | "two_pct_rule"
  | "fifty_pct_rule"
  | "seventy_pct_rule"
  | "grm"
  | "opex_ratio"
  | "arv"
  | "mao"
  | "vacancy"
  | "maintenance"
  | "management"
  | "principal_paydown"
  | "appreciation"
  | "depreciation_deduction"
  | "interest_deduction"
  | "after_tax_cashflow"
  | "break_even_rent"
  | "break_even_occupancy"
  | "brrrr_score"
  | "refi_cashout"
  | "cash_left_in_deal"
  | "post_refi_cashflow"
  | "exit_cap_rate"
  | "piq_score"
  | "market_heat"
  | "rent_index"
  | "net_migration";

export const GLOSSARY: Record<GlossaryKey, GlossaryEntry> = {
  cap_rate: {
    name: "Cap Rate",
    formula: "NOI ÷ Purchase Price",
    plain: "What yield the property earns if you bought it cash.",
    whyMatters:
      "Quick apples-to-apples way to compare unlevered yields across markets.",
  },
  coc: {
    name: "Cash-on-Cash Return",
    formula: "Annual Cashflow ÷ Total Cash Invested",
    plain: "Yield on the actual cash you put in, after debt service.",
    whyMatters: "The number that tells you what your cash is doing year-1.",
  },
  dscr: {
    name: "Debt Service Coverage Ratio (DSCR)",
    formula: "NOI ÷ Annual Debt Service",
    plain: "How many times the rent covers the mortgage.",
    whyMatters:
      "Lenders require DSCR > 1.0 (often 1.20+); below 1.0 means the rent doesn't cover the loan.",
  },
  noi: {
    name: "Net Operating Income",
    formula: "Gross Rent − Operating Expenses (excludes debt + taxes)",
    plain:
      "Operating profit before mortgage interest, principal, and income taxes.",
    whyMatters:
      "The numerator of cap rate; the income figure that values commercial-style real estate.",
  },
  cashflow: {
    name: "Monthly Cashflow",
    formula: "(NOI ÷ 12) − Monthly Debt Service",
    plain: "Dollars in your pocket each month after the bank is paid.",
    whyMatters:
      "Negative cashflow means you're feeding the deal; positive means it pays you to hold.",
  },
  irr: {
    name: "Internal Rate of Return (IRR)",
    formula: "Discount rate that makes NPV of cashflows = 0",
    plain:
      "Annualized total return including cashflow, equity build, and exit appreciation.",
    whyMatters:
      "The single best metric for comparing levered RE deals over multi-year holds.",
  },
  one_pct_rule: {
    name: "1% Rule",
    formula: "Monthly Rent ≥ 1% of Purchase Price",
    plain: "A back-of-napkin floor for whether a deal might cashflow.",
    whyMatters:
      "Gut check; deals failing it usually need very low rates or strong appreciation to make sense.",
  },
  two_pct_rule: {
    name: "2% Rule",
    formula: "Monthly Rent ≥ 2% of Purchase Price",
    plain: "An aggressive floor seen in low-priced cashflow markets.",
    whyMatters:
      "Indicates a strong cashflow profile; rare in appreciating coastal markets.",
  },
  fifty_pct_rule: {
    name: "50% Rule",
    formula: "Operating Expenses ≈ 50% of Gross Rent",
    plain:
      "Heuristic that opex (vacancy + repairs + taxes + insurance + management) eats half the rent.",
    whyMatters: "Quick reality check on rosy expense estimates.",
  },
  seventy_pct_rule: {
    name: "70% Rule (Flips)",
    formula: "MAO = ARV × 0.70 − Rehab",
    plain:
      "Maximum Allowable Offer for a flip target — 70% of after-repair value, minus rehab.",
    whyMatters:
      "Sets your bid ceiling so the spread covers holding + selling costs + profit.",
  },
  grm: {
    name: "Gross Rent Multiplier (GRM)",
    formula: "Price ÷ Annual Gross Rent",
    plain: "How many years of gross rent equals the price.",
    whyMatters:
      "Lower = better. Used to screen pre-NOI; doesn't account for opex.",
  },
  opex_ratio: {
    name: "Operating Expense Ratio",
    formula: "Operating Expenses ÷ Gross Rent",
    plain: "What share of rent gets eaten before debt service.",
    whyMatters: "High ratios shrink NOI and DSCR even with strong rent.",
  },
  arv: {
    name: "After-Repair Value (ARV)",
    formula: "Estimated market value after planned rehab",
    plain: "What the property will appraise for once renovated.",
    whyMatters:
      "Anchors flip MAO and BRRRR refi proceeds — wrong ARV breaks both.",
  },
  mao: {
    name: "Maximum Allowable Offer (MAO)",
    formula: "ARV × 0.70 − Rehab (flips); ARV × 0.75 − Rehab (BRRRR)",
    plain: "The most you can pay and still hit your target margin.",
    whyMatters: "Discipline tool: if asking > MAO, you negotiate or pass.",
  },
  vacancy: {
    name: "Vacancy",
    formula: "Vacancy Loss = Gross Rent × Vacancy %",
    plain: "Income lost while the unit is empty between tenants.",
    whyMatters:
      "Even in hot markets budget 5–8%; turnover is real even at low vacancy.",
  },
  maintenance: {
    name: "Maintenance Reserve",
    formula: "Maintenance = Gross Rent × Maintenance %",
    plain: "Set-aside for routine repairs and capex over time.",
    whyMatters: "Underbudgeting maintenance is the #1 way pro-formas lie.",
  },
  management: {
    name: "Property Management",
    formula: "Management Fee = Gross Rent × Management %",
    plain: "What you pay a PM to handle tenants and maintenance.",
    whyMatters:
      "Self-managing isn't free — your time has value; budget 8–10% if you'll outsource later.",
  },
  principal_paydown: {
    name: "Principal Paydown",
    formula: "Year-N Principal = sum of monthly principal portions",
    plain: "How much of the mortgage balance you pay down each year.",
    whyMatters:
      "Tenant pays the loan down for you — silent equity that compounds.",
  },
  appreciation: {
    name: "Appreciation Gain",
    formula: "Property Value × (1 + appreciation %) − Purchase Price",
    plain: "Increase in property value since purchase.",
    whyMatters:
      "Multiplies leveraged return — modest appreciation can dwarf cashflow over a long hold.",
  },
  depreciation_deduction: {
    name: "Depreciation Deduction",
    formula: "Building Basis ÷ 27.5 years",
    plain: "Non-cash IRS deduction for residential rental wear-and-tear.",
    whyMatters:
      "Shields rental income from tax — often turns positive cashflow into a paper loss for tax purposes.",
  },
  interest_deduction: {
    name: "Mortgage Interest Deduction",
    formula: "Annual interest paid on the loan",
    plain: "Deductible business expense for rental properties.",
    whyMatters:
      "Largest expense in early years of an amortizing loan; major tax shield.",
  },
  after_tax_cashflow: {
    name: "After-Tax Cashflow",
    formula: "Pre-tax Cashflow + Tax Benefit from Shields",
    plain:
      "Cashflow after factoring depreciation + interest deductions at your marginal rate.",
    whyMatters:
      "True economic return — what hits your bank account after you file.",
  },
  break_even_rent: {
    name: "Break-Even Rent",
    formula: "(Fixed Costs + Debt Service) ÷ (1 − Variable Cost %)",
    plain: "The lowest monthly rent at which the property breaks even.",
    whyMatters:
      "Cushion = (current rent − break-even) ÷ current rent. Bigger cushion = more downside protection.",
  },
  break_even_occupancy: {
    name: "Break-Even Occupancy",
    formula: "Break-Even Rent ÷ Current Rent",
    plain: "What % of full-rent months you need to break even.",
    whyMatters:
      "Tells you how much vacancy you can stomach before the deal turns negative.",
  },
  brrrr_score: {
    name: "BRRRR Score",
    formula:
      "Composite of refi cash-out + post-refi cashflow + cash left in deal",
    plain:
      "Single number summarizing how well the BRRRR strategy works for this deal.",
    whyMatters: "Quick way to compare BRRRR-suitability across deals.",
  },
  refi_cashout: {
    name: "Refi Cash-Out",
    formula: "ARV × Refi LTV − Existing Loan Balance",
    plain: "Cash you pull out at refinance after seasoning.",
    whyMatters: "Bigger cash-out = more capital recycled into the next deal.",
  },
  cash_left_in_deal: {
    name: "Cash Left in Deal",
    formula: "Initial Cash + Rehab − Refi Cash-Out",
    plain: "Capital still trapped in the property after the refi.",
    whyMatters:
      "Lower = better. The dream is $0 left in deal (infinite cash-on-cash on residual cashflow).",
  },
  post_refi_cashflow: {
    name: "Post-Refi Cashflow",
    formula: "NOI − Post-Refi Debt Service",
    plain: "Monthly cashflow after the new loan is in place.",
    whyMatters:
      "Higher debt service after refi can erase cashflow — verify it still pencils.",
  },
  exit_cap_rate: {
    name: "Exit Cap Rate",
    formula: "Assumed Cap Rate at Sale ÷ Future NOI",
    plain: "What cap rate you assume buyers will use when you sell.",
    whyMatters:
      "Cap-rate compression boosts IRR; expansion crushes it. Test both scenarios.",
  },
  piq_score: {
    name: "PropertyIQ Score",
    formula:
      "z(% sold above list) − z(median DOM) − z(months of supply), percentile-ranked within state",
    plain: "Demand strength of the market relative to the state, 1–99.",
    whyMatters:
      "50 = state average; 80+ markets are sellers' markets where price negotiation is harder.",
  },
  market_heat: {
    name: "Market Heat Index",
    formula: "Composite of price growth, days-on-market, sale-to-list ratio",
    plain: "Single index summarizing whether a metro is hot or cold right now.",
    whyMatters:
      "Hot markets favor sellers and appreciation plays; cold markets favor cashflow.",
  },
  rent_index: {
    name: "Rent Index",
    formula: "Zillow ZORI / Apartment List index",
    plain: "Smoothed median rent for the geography over time.",
    whyMatters:
      "Rent trends are a key input to your future-cashflow assumption.",
  },
  net_migration: {
    name: "Net Migration",
    formula: "Inflows − Outflows (annual)",
    plain: "Net population change from people moving in or out.",
    whyMatters:
      "Sustained inflows drive long-term rent + price growth; outflows are a long-term tailwind for vacancy.",
  },
};

export function getGlossaryEntry(key: GlossaryKey): GlossaryEntry {
  return GLOSSARY[key];
}
