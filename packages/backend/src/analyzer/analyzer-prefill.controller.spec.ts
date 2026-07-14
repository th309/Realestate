import { AnalyzerController } from './analyzer.controller';

function makeController(isPro: boolean) {
  const service = {} as never;
  const prefillService = {
    getPrefillBundle: jest
      .fn()
      .mockResolvedValue({ hasParcelData: isPro, fields: {}, notes: [] }),
  };
  const tierGate = {
    isPro: jest.fn().mockResolvedValue(isPro),
    requirePro: jest.fn(),
  };
  const controller = new AnalyzerController(
    service,
    prefillService as never,
    {} as never,
    tierGate as never,
    {} as never,
    {} as never,
  );
  return { controller, prefillService, tierGate };
}

describe('AnalyzerController.getPrefill', () => {
  it('passes isPro=false for anonymous requests', async () => {
    const { controller, prefillService, tierGate } = makeController(false);
    const req = { userId: undefined } as never;
    await controller.getPrefill(req, { zip: '78702' } as never);
    expect(tierGate.isPro).toHaveBeenCalledWith(undefined);
    expect(prefillService.getPrefillBundle).toHaveBeenCalledWith(
      { zip: '78702' },
      { isPro: false },
    );
  });

  it('passes isPro=true when the authed user is Pro', async () => {
    const { controller, prefillService } = makeController(true);
    const req = { userId: 'u1' } as never;
    await controller.getPrefill(req, {
      zip: '78702',
      address: '1 Main St',
    } as never);
    expect(prefillService.getPrefillBundle).toHaveBeenCalledWith(
      { zip: '78702', address: '1 Main St' },
      { isPro: true },
    );
  });
});
