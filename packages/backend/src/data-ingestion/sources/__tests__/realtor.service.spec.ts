import { Test, TestingModule } from '@nestjs/testing';
import { RealtorService } from '../realtor.service';
import { SupabaseService } from '../../../supabase/supabase.service';
import axios from 'axios';

jest.mock('axios');

describe('RealtorService', () => {
    let service: RealtorService;
    let supabaseService: SupabaseService;

    const mockSupabaseClient = {
        from: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
    };

    const mockSupabaseService = {
        getClient: jest.fn().mockReturnValue(mockSupabaseClient),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RealtorService,
                {
                    provide: SupabaseService,
                    useValue: mockSupabaseService,
                },
            ],
        }).compile();

        service = module.get<RealtorService>(RealtorService);
        supabaseService = module.get<SupabaseService>(SupabaseService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should download and parse national data', async () => {
        // Mock CSV response
        const csvContent = `month_date_yyyymm,country,median_listing_price,active_listing_count
202301,United States,400000,500000
202302,United States,410000,510000`;

        (axios.get as jest.Mock).mockResolvedValue({ data: csvContent });

        mockSupabaseClient.select.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }], error: null });

        const result = await service.importDataset('realtor-national');

        expect(result.success).toBe(true);
        expect(axios.get).toHaveBeenCalled();
        expect(mockSupabaseService.getClient).toHaveBeenCalled();
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('realtor_national');
        expect(mockSupabaseClient.upsert).toHaveBeenCalledTimes(1); // One batch
    });

    it('should handle errors gracefully', async () => {
        (axios.get as jest.Mock).mockRejectedValue(new Error('Network error'));

        const result = await service.importDataset('realtor-national');

        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
    });
});
