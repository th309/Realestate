import { AnalyzerTierGate } from './analyzer-tier-gate.service';

function makeGate(tier: string | null) {
  const entitlements = { getUserTier: jest.fn().mockResolvedValue(tier) };
  return new AnalyzerTierGate(entitlements as never);
}

describe('AnalyzerTierGate.isPro', () => {
  it('returns false for undefined userId without calling entitlements', async () => {
    const entitlements = { getUserTier: jest.fn() };
    const gate = new AnalyzerTierGate(entitlements as never);
    expect(await gate.isPro(undefined)).toBe(false);
    expect(entitlements.getUserTier).not.toHaveBeenCalled();
  });

  it.each(['pro', 'enterprise', 'admin'])(
    'returns true for %s',
    async (tier) => {
      expect(await makeGate(tier).isPro('u1')).toBe(true);
    },
  );

  it.each(['free', null])('returns false for %s', async (tier) => {
    expect(await makeGate(tier).isPro('u1')).toBe(false);
  });
});
