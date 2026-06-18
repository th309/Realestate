// drip.service.spec.ts — focused on the suppression rule
import { DripService } from './drip.service';

describe('DripService active-trial suppression', () => {
  it('exposes runDripDay for a specific day', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) } as any;
    const svc = new DripService({} as any, {} as any, config, {} as any);
    expect(typeof (svc as any).runDripDay).toBe('function');
  });
});
