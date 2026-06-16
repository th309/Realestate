import { UsageCoverageService } from '../usage-coverage.service';

describe('UsageCoverageService.toCoverage', () => {
  it('dedupes feature actions and reports mcpConnected', () => {
    const out = UsageCoverageService.toCoverage(
      [
        { event_action: 'analyzer_grade' },
        { event_action: 'analyzer_grade' },
        { event_action: 'screener_filter' },
      ],
      /* hasMcpToken */ true,
    );
    expect(out.usedFeatures.sort()).toEqual([
      'analyzer_grade',
      'screener_filter',
    ]);
    expect(out.mcpConnected).toBe(true);
  });

  it('returns mcpConnected=false when no live token', () => {
    const out = UsageCoverageService.toCoverage(
      [{ event_action: 'graphs_view' }],
      false,
    );
    expect(out.usedFeatures).toEqual(['graphs_view']);
    expect(out.mcpConnected).toBe(false);
  });

  it('returns an empty feature set for no events', () => {
    const out = UsageCoverageService.toCoverage([], false);
    expect(out.usedFeatures).toEqual([]);
    expect(out.mcpConnected).toBe(false);
  });
});
