import { Test } from '@nestjs/testing';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { RankingResolverController } from './ranking-resolver.controller';
import { RankingResolverService } from './ranking-resolver.service';

describe('RankingResolverController', () => {
  let controller: RankingResolverController;
  let resolver: jest.Mocked<RankingResolverService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RankingResolverController],
      providers: [
        { provide: RankingResolverService, useValue: { resolve: jest.fn() } },
      ],
    })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(RankingResolverController);
    resolver = moduleRef.get(RankingResolverService);
  });

  it('forwards resolved result from service', async () => {
    const stub = { rankings: [], insufficient_data: true } as any;
    resolver.resolve.mockResolvedValue(stub);

    const result = await controller.resolve({
      format: 'top_10_ranking',
      metric_id: 'piq_score',
      geo_level: 'metro',
      scope_type: 'national',
      scope_id: null,
    } as any);

    expect(result).toBe(stub);
    expect(resolver.resolve).toHaveBeenCalled();
  });
});
