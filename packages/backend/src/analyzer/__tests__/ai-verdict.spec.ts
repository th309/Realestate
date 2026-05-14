import { AnalyzerService } from '../analyzer.service';

describe('AnalyzerService.buildVerdictPrompt', () => {
  it('includes input, result, market context, and required output schema', () => {
    const svc = new AnalyzerService(null as any, null as any, null as any);
    const prompt = svc.buildVerdictPrompt({
      input: {
        price: 425_000,
        rentMonthly: 2_950,
        taxAnnual: 7_650,
        insuranceAnnual: 1_800,
        financing: {
          downPaymentPct: 0.2,
          interestRatePct: 7.1,
          termYears: 30,
        },
      } as any,
      result: { capRatePct: 4.2, cashflowMonthly: 284, dscr: 1.18 } as any,
      marketContext: { piq_score: { value: 73, label: 'GOOD' } } as any,
    });

    expect(prompt).toContain('425000');
    expect(prompt).toContain('cap rate');
    expect(prompt).toContain('verdict');
    expect(prompt).toContain('buy');
    expect(prompt).toContain('negotiate');
    expect(prompt).toContain('pass');
  });
});
