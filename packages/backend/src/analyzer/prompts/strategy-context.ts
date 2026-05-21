/**
 * Strategy-specific context used by `assemblePrompt` to teach the LLM what
 * matters for the active investor play. Surfacing these tables as plain data
 * (rather than baking them into the section prompts) keeps the strategy
 * awareness available to every section uniformly — header verdict, sensitivity,
 * recommendation analysis, etc. all see the same authoritative description of
 * "what matters for buy and hold vs fix and flip vs BRRRR".
 *
 * If you add a fourth strategy to analyzer-core, add it here too — that's all
 * the prompt layer needs to know about it.
 */

export type AnalysisStrategy = 'BUY_AND_HOLD' | 'FIX_AND_FLIP' | 'BRRRR';

export const STRATEGY_DISPLAY: Record<AnalysisStrategy, string> = {
  BUY_AND_HOLD: 'buy and hold rental',
  FIX_AND_FLIP: 'fix and flip',
  BRRRR: 'BRRRR (buy, rehab, rent, refinance, repeat)',
};

export const STRATEGY_KEY_METRICS: Record<AnalysisStrategy, string> = {
  BUY_AND_HOLD:
    'monthly cashflow, cap rate, cash-on-cash return, DSCR, and long-term wealth from principal paydown plus appreciation',
  FIX_AND_FLIP:
    'net profit after all costs (purchase, rehab, holding, selling), ARV (after-repair value), rehab budget vs contingency, holding period in months, and the maximum allowable offer multiplier',
  BRRRR:
    'the refinance outcome (does the new loan cover the all-in basis?), refinance LTV cap, cashflow after the refinance, equity left in the property, ARV, rehab budget, and seasoning months before refi',
};

export const STRATEGY_LEVERS: Record<AnalysisStrategy, string> = {
  BUY_AND_HOLD:
    'lowering purchase price, raising rent, locking a lower interest rate, or increasing the down payment',
  FIX_AND_FLIP:
    'lowering purchase price, trimming rehab budget, increasing ARV (better finish or scope), shortening the holding period, or reducing selling cost percentage',
  BRRRR:
    'lowering purchase price, trimming rehab budget, raising ARV so the refinance pulls out more cash, increasing the refinance LTV, or shortening seasoning months',
};
