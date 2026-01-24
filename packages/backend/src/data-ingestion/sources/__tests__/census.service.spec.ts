import { Test, TestingModule } from '@nestjs/testing';
import { CensusService } from '../census.service';
import { SupabaseService } from '../../../supabase/supabase.service';

describe('CensusService', () => {
    let service: CensusService;
    let supabaseServiceMock: any;

    beforeEach(async () => {
        supabaseServiceMock = {
            getClient: jest.fn().mockReturnValue({
                from: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                ilike: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
                upsert: jest.fn().mockResolvedValue({ error: null }),
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CensusService,
                { provide: SupabaseService, useValue: supabaseServiceMock },
            ],
        }).compile();

        service = module.get<CensusService>(CensusService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
