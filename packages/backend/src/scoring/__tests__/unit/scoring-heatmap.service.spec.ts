import { Test, TestingModule } from '@nestjs/testing';
import { ScoringHeatmapService } from '../../scoring-heatmap.service';
import { SUPABASE_CLIENT } from '../../../supabase/supabase.service';
import { RedisService } from '../../../redis/redis.service';

const samplePayload = {
  months: ['2026-04-30', '2026-05-31'],
  metros: [
    {
      id: '19780',
      name: 'Des Moines-West Des Moines, IA',
      lat: 41.512,
      lon: -93.729,
      pop: 737164,
      conf: 'A',
    },
  ],
  scores: [[55, 57]],
};

describe('ScoringHeatmapService', () => {
  let service: ScoringHeatmapService;
  const mockSupabase = { rpc: jest.fn() };
  const mockRedis = { getByKey: jest.fn(), setByKey: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringHeatmapService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();
    service = module.get<ScoringHeatmapService>(ScoringHeatmapService);
    jest.clearAllMocks();
  });

  it('returns the RPC payload and caches it when Redis is empty', async () => {
    mockRedis.getByKey.mockResolvedValue(null);
    mockRedis.setByKey.mockResolvedValue(true);
    mockSupabase.rpc.mockResolvedValue({ data: samplePayload, error: null });

    const result = await service.getMetroHeatmap();

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_metro_score_heatmap');
    expect(mockRedis.setByKey).toHaveBeenCalledWith(
      'heatmap:v1:metro',
      samplePayload,
      86400,
    );
    expect(result.metros[0].id).toBe('19780');
    expect(result.scores[0]).toEqual([55, 57]);
  });

  it('serves from Redis without hitting the database', async () => {
    mockRedis.getByKey.mockResolvedValue(samplePayload);

    const result = await service.getMetroHeatmap();

    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(result).toEqual(samplePayload);
  });

  it('throws when the RPC returns an error', async () => {
    mockRedis.getByKey.mockResolvedValue(null);
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: new Error('rpc failed'),
    });

    await expect(service.getMetroHeatmap()).rejects.toThrow('rpc failed');
    expect(mockRedis.setByKey).not.toHaveBeenCalled();
  });

  it('throws and does not cache when the RPC returns a malformed payload', async () => {
    mockRedis.getByKey.mockResolvedValue(null);
    mockSupabase.rpc.mockResolvedValue({
      data: { months: [], metros: [], scores: [] },
      error: null,
    });

    await expect(service.getMetroHeatmap()).rejects.toThrow(
      'get_metro_score_heatmap returned a malformed payload',
    );
    expect(mockRedis.setByKey).not.toHaveBeenCalled();
  });
});
