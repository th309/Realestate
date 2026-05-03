import { Test } from '@nestjs/testing';
import { EmploymentSectorsService } from '../employment-sectors.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('EmploymentSectorsService', () => {
  let service: EmploymentSectorsService;
  let supabase: jest.Mocked<SupabaseService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EmploymentSectorsService,
        { provide: SupabaseService, useValue: { from: jest.fn() } },
      ],
    }).compile();
    service = module.get(EmploymentSectorsService);
    supabase = module.get(SupabaseService);
  });

  it('returns top-N sectors as percent shares', async () => {
    const limitMock = jest.fn().mockResolvedValue({
      data: [
        {
          naics_code: '54',
          naics_label: 'Professional Services',
          employment: 28000,
        },
        { naics_code: '62', naics_label: 'Healthcare', employment: 19000 },
        { naics_code: '54xx', naics_label: 'Biotech', employment: 15000 },
      ],
      error: null,
    });
    const orderMock = jest.fn().mockReturnValue({ limit: limitMock });
    const eqMock = jest.fn().mockReturnValue({ order: orderMock });
    const eq2Mock = jest.fn().mockReturnValue({ eq: eqMock });
    const selectMock = jest.fn().mockReturnValue({ eq: eq2Mock });
    supabase.from.mockReturnValue({ select: selectMock } as any);

    const result = await service.getTopSectors({
      countyFips: '37183',
      topN: 5,
    });

    expect(result.sectors).toHaveLength(3);
    expect(result.sectors[0].percentShare).toBeCloseTo(45.16, 1); // 28000 / 62000
    expect(result.totalEmployment).toBe(62000);
  });
});
