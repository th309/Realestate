import { Test } from '@nestjs/testing';
import { PeersService } from '../peers.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('PeersService', () => {
  let service: PeersService;
  let supabase: jest.Mocked<SupabaseService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PeersService,
        { provide: SupabaseService, useValue: { from: jest.fn() } },
      ],
    }).compile();
    service = module.get(PeersService);
    supabase = module.get(SupabaseService);
  });

  it('returns top-3 peers ranked by score-similarity within parent metro', async () => {
    const fromMock = jest.fn().mockReturnThis();
    const selectMock = jest.fn().mockReturnThis();
    const eqMock = jest.fn().mockReturnThis();
    const limitMock = jest.fn().mockResolvedValue({
      data: [
        {
          geo_id: 'apex-nc',
          name: 'Apex, NC',
          score: 81,
          household_count: 22000,
        },
        {
          geo_id: 'holly-springs-nc',
          name: 'Holly Springs, NC',
          score: 79,
          household_count: 14000,
        },
        {
          geo_id: 'morrisville-nc',
          name: 'Morrisville, NC',
          score: 84,
          household_count: 12000,
        },
      ],
      error: null,
    });
    supabase.from.mockReturnValue({
      select: selectMock,
      eq: eqMock,
      limit: limitMock,
    } as any);
    selectMock.mockReturnValue({ eq: eqMock, limit: limitMock });
    eqMock.mockReturnValue({ eq: eqMock, limit: limitMock });

    const peers = await service.findPeers({
      geoLevel: 'city',
      geoId: 'cary-nc',
      score: 87,
      parentMetro: '39580',
      householdCount: 62000,
    });

    expect(peers).toHaveLength(3);
    // Combined distance = scoreDist + sizeDist*10. Given input score=87, hh=62000:
    //   Morrisville (score=84, hh=12000): 3 + (50000/62000)*10 = ~11.06
    //   Apex        (score=81, hh=22000): 6 + (40000/62000)*10 = ~12.45
    //   Holly Spr.  (score=79, hh=14000): 8 + (48000/62000)*10 = ~15.74
    expect(peers[0].name).toBe('Morrisville, NC'); // closest combined score+size
  });
});
