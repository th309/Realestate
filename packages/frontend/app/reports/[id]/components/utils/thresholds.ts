/**
 * Market analysis threshold constants
 *
 * These constants define the thresholds used for evaluating market conditions,
 * cash flow metrics, and risk assessments throughout the report sections.
 * Centralizing these values ensures consistency and makes calibration easier.
 */

/**
 * Days on Market thresholds for market type determination
 */
export const DAYS_ON_MARKET = {
  /** DOM >= 60 indicates a buyer's market with slower sales */
  BUYERS_MARKET: 60,
  /** DOM >= 40 indicates a neutral/transitional market */
  NEUTRAL: 40,
  /** DOM <= 30 indicates a slight seller's market */
  SLIGHT_SELLERS: 30,
  /** DOM <= 20 indicates a strong seller's market */
  SELLERS_MARKET: 20,
  /** DOM <= 21 indicates a fast-moving market tempo */
  FAST_TEMPO: 21,
  /** DOM <= 45 indicates a moderate market tempo */
  MODERATE_TEMPO: 45,
  /** DOM >= 90 indicates high liquidity risk */
  HIGH_LIQUIDITY_RISK: 90,
  /** DOM >= 60 indicates medium liquidity risk */
  MEDIUM_LIQUIDITY_RISK: 60,
} as const;

/**
 * Cap Rate thresholds for investment quality
 */
export const CAP_RATE = {
  /** Cap rate >= 8% is considered excellent for cash flow */
  EXCELLENT: 8,
  /** Cap rate >= 7% is considered good */
  GOOD: 7,
  /** Cap rate >= 5% is considered moderate */
  MODERATE: 5,
  /** Cap rate < 4% is considered weak */
  WEAK: 4,
} as const;

/**
 * Vacancy Rate thresholds for tenant demand risk
 */
export const VACANCY_RATE = {
  /** Vacancy >= 10% indicates high risk of extended vacancies */
  HIGH_RISK: 10,
  /** Vacancy >= 6% indicates elevated risk */
  MEDIUM_RISK: 6,
} as const;

/**
 * Hotness Score thresholds for market competitiveness
 */
export const HOTNESS_SCORE = {
  /** Score >= 80 indicates a very hot seller's market */
  VERY_HOT: 80,
  /** Score >= 70 indicates a hot market */
  HOT: 70,
  /** Score >= 65 indicates a warm seller's market */
  WARM: 65,
  /** Score <= 50 indicates a cooling market (neutral) */
  NEUTRAL: 50,
  /** Score >= 40 indicates active market tempo */
  ACTIVE: 40,
  /** Score <= 30 indicates a cool buyer's market */
  COOL: 30,
} as const;

/**
 * Overvalued Percentage thresholds for pricing risk
 */
export const OVERVALUED_PCT = {
  /** >= 15% overvalued indicates high risk of price correction */
  HIGH_RISK: 15,
  /** >= 5% overvalued indicates moderate pricing risk */
  MEDIUM_RISK: 5,
  /** Values between -5% and 5% are considered fair value */
  FAIR_VALUE_THRESHOLD: 5,
} as const;

/**
 * Gross Rent Multiplier thresholds (lower is better)
 */
export const GROSS_RENT_MULTIPLIER = {
  /** GRM <= 10 indicates fast payback potential */
  EXCELLENT: 10,
  /** GRM <= 15 is typical for most markets */
  GOOD: 15,
  /** GRM > 20 indicates longer time to recoup investment */
  POOR: 20,
} as const;

/**
 * Gross Yield thresholds for rental income evaluation
 */
export const GROSS_YIELD = {
  /** Yield >= 8% is considered excellent */
  EXCELLENT: 8,
  /** Yield >= 6% is considered good */
  GOOD: 6,
  /** Yield < 4% is considered weak */
  WEAK: 4,
} as const;

/**
 * Cash-on-Cash Return thresholds
 */
export const CASH_ON_CASH = {
  /** >= 8% is excellent cash-on-cash return */
  EXCELLENT: 8,
  /** >= 5% is good cash-on-cash return */
  GOOD: 5,
} as const;

/**
 * Sale-to-List Ratio thresholds (as percentage, e.g., 100 = 100%)
 */
export const SALE_TO_LIST_RATIO = {
  /** >= 102% indicates homes selling above list (strong seller's market) */
  ABOVE_LIST_STRONG: 102,
  /** >= 100% indicates homes selling at or above list */
  AT_OR_ABOVE_LIST: 100,
  /** <= 98% indicates slight discount from list */
  SLIGHT_DISCOUNT: 98,
  /** <= 95% indicates significant negotiation room */
  SIGNIFICANT_DISCOUNT: 95,
} as const;

/**
 * Price Cut Percentage thresholds for negotiation leverage
 */
export const PRICE_CUT_PCT = {
  /** >= 30% of listings with cuts indicates strong buyer leverage */
  STRONG_BUYER_LEVERAGE: 30,
  /** >= 20% indicates moderate buyer leverage */
  MODERATE_BUYER_LEVERAGE: 20,
  /** <= 10% indicates limited negotiation room */
  LIMITED_LEVERAGE: 10,
  /** <= 5% indicates very competitive market */
  VERY_COMPETITIVE: 5,
} as const;

/**
 * Unemployment Rate thresholds for economic risk
 */
export const UNEMPLOYMENT_RATE = {
  /** >= 8% indicates high economic risk */
  HIGH_RISK: 8,
  /** >= 5% indicates elevated economic risk */
  ELEVATED_RISK: 5,
} as const;

/**
 * Job Growth thresholds for economic health
 */
export const JOB_GROWTH = {
  /** < -2% indicates significant job losses */
  DECLINING: -2,
  /** < 1% indicates stagnant growth */
  STAGNANT: 1,
} as const;

/**
 * Inventory (months of supply) thresholds for liquidity
 */
export const INVENTORY_MONTHS = {
  /** >= 6 months indicates buyer's market / high liquidity risk */
  HIGH_RISK: 6,
  /** >= 4 months indicates balanced to buyer's market */
  MEDIUM_RISK: 4,
} as const;

/**
 * Risk Score thresholds from InvestorEdge scoring
 */
export const RISK_SCORE = {
  /** Score >= 80 indicates very low risk */
  VERY_LOW: 80,
  /** Score >= 60 indicates below average risk */
  LOW: 60,
  /** Score >= 40 indicates moderate risk */
  MODERATE: 40,
  /** Score >= 20 indicates above average risk */
  ELEVATED: 20,
} as const;

/**
 * Normalized score thresholds for market type calculations
 * Used to determine strength of buyer/seller market conditions
 */
export const NORMALIZED_SCORE = {
  /** Score >= 1.5 indicates strong conditions */
  STRONG: 1.5,
  /** Score >= 0.75 indicates moderate conditions */
  MODERATE: 0.75,
  /** Score >= 0.25 indicates slight conditions */
  SLIGHT: 0.25,
} as const;

/**
 * Combined market thresholds object for convenient importing
 */
export const MARKET_THRESHOLDS = {
  DAYS_ON_MARKET,
  CAP_RATE,
  VACANCY_RATE,
  HOTNESS_SCORE,
  OVERVALUED_PCT,
  GROSS_RENT_MULTIPLIER,
  GROSS_YIELD,
  CASH_ON_CASH,
  SALE_TO_LIST_RATIO,
  PRICE_CUT_PCT,
  UNEMPLOYMENT_RATE,
  JOB_GROWTH,
  INVENTORY_MONTHS,
  RISK_SCORE,
  NORMALIZED_SCORE,
} as const;

export default MARKET_THRESHOLDS;
