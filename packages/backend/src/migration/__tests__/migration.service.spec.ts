import { Test } from '@nestjs/testing';
import { MigrationService } from '../migration.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('MigrationService', () => {
  let service: MigrationService;
  let supabase: jest.Mocked<SupabaseService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MigrationService,
        { provide: SupabaseService, useValue: { from: jest.fn() } },
      ],
    }).compile();
    service = module.get(MigrationService);
    supabase = module.get(SupabaseService);
  });

  it('returns top-N inflow source counties for a destination county', async () => {
    const limitMock = jest.fn().mockResolvedValue({
      data: [
        {
          from_county_fips: '36061',
          from_name: 'New York County, NY',
          inflow_count: 1840,
        },
        {
          from_county_fips: '11001',
          from_name: 'District of Columbia',
          inflow_count: 1210,
        },
      ],
      error: null,
    });
    const orderMock = jest.fn().mockReturnValue({ limit: limitMock });
    const eqMock = jest.fn().mockReturnValue({ order: orderMock });
    const eq2Mock = jest.fn().mockReturnValue({ eq: eqMock });
    const selectMock = jest.fn().mockReturnValue({ eq: eq2Mock });
    supabase.from.mockReturnValue({ select: selectMock } as any);

    const result = await service.getTopInflows({
      countyFips: '37183',
      limit: 5,
      year: 2024,
    });

    expect(result).toHaveLength(2);
    expect(result[0].fromCountyFips).toBe('36061');
    expect(result[0].inflowCount).toBe(1840);
  });

  it('returns empty array when no migration data exists for the county', async () => {
    const limitMock = jest.fn().mockResolvedValue({ data: [], error: null });
    const orderMock = jest.fn().mockReturnValue({ limit: limitMock });
    const eqMock = jest.fn().mockReturnValue({ order: orderMock });
    const eq2Mock = jest.fn().mockReturnValue({ eq: eqMock });
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({ eq: eq2Mock }),
    } as any);

    const result = await service.getTopInflows({
      countyFips: '99999',
      limit: 5,
      year: 2024,
    });
    expect(result).toEqual([]);
  });
});
