import { Test, TestingModule } from '@nestjs/testing';
import { FredService } from '../fred.service';
import { SupabaseService } from '../../../supabase/supabase.service';

describe('FredService', () => {
    let service: FredService;
    let supabaseServiceMock: any;

    beforeEach(async () => {
        supabaseServiceMock = {
            getClient: jest.fn().mockReturnValue({
                from: jest.fn().mockReturnThis(),
                upsert: jest.fn().mockReturnThis(),
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FredService,
                { provide: SupabaseService, useValue: supabaseServiceMock },
            ],
        }).compile();

        service = module.get<FredService>(FredService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
