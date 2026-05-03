import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MarketsController } from '../markets.controller';
import { MarketsService } from '../markets.service';
import { PeersService } from '../peers.service';

describe('MarketsController GET /peers', () => {
  let controller: MarketsController;
  let peers: jest.Mocked<PeersService>;
  let marketsService: jest.Mocked<MarketsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [MarketsController],
      providers: [
        {
          provide: MarketsService,
          useValue: { getMarketCore: jest.fn() },
        },
        {
          provide: PeersService,
          useValue: { findPeers: jest.fn() },
        },
      ],
    }).compile();
    controller = module.get(MarketsController);
    peers = module.get(PeersService);
    marketsService = module.get(MarketsService);
  });

  it('returns top-3 peers for the given geography', async () => {
    marketsService.getMarketCore.mockResolvedValue({
      score: 87,
      parentMetroCbsa: '39580',
      householdCount: 62000,
      name: 'Cary, NC',
    });
    peers.findPeers.mockResolvedValue([
      {
        geoLevel: 'city',
        geoId: 'apex-nc',
        name: 'Apex, NC',
        score: 81,
        householdCount: 22000,
      },
    ]);

    const result = await controller.getPeers('city', 'cary-nc');

    expect(result.peers).toHaveLength(1);
    expect(result.source).toEqual({
      score: 87,
      parentMetroCbsa: '39580',
      householdCount: 62000,
      name: 'Cary, NC',
    });
    expect(peers.findPeers).toHaveBeenCalledWith(
      expect.objectContaining({
        geoLevel: 'city',
        geoId: 'cary-nc',
        score: 87,
        parentMetro: '39580',
        householdCount: 62000,
      }),
    );
  });

  it('throws BadRequestException when source market not found', async () => {
    marketsService.getMarketCore.mockResolvedValue(null);

    await expect(controller.getPeers('city', 'unknown-xx')).rejects.toThrow(
      BadRequestException,
    );
    expect(peers.findPeers).not.toHaveBeenCalled();
  });

  it('returns empty peers when source has null score (unscored market)', async () => {
    marketsService.getMarketCore.mockResolvedValue({
      score: null,
      parentMetroCbsa: null,
      householdCount: 0,
      name: 'Test Market',
    });

    const result = await controller.getPeers('city', 'unscored-market');

    expect(result.peers).toEqual([]);
    expect(peers.findPeers).not.toHaveBeenCalled();
  });
});
