import { ReportsService } from '../reports.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('ReportsService.saveBuilderTemplate', () => {
  it('inserts a private, user-owned report_templates row and returns id + slug', async () => {
    const insertPayloads: any[] = [];
    const client = {
      from: jest.fn((table: string) => {
        if (table !== 'report_templates') {
          throw new Error(`Unexpected table: ${table}`);
        }
        return {
          insert: jest.fn((payload: any) => {
            insertPayloads.push(payload);
            return {
              select: jest.fn(() => ({
                single: jest.fn(() =>
                  Promise.resolve({
                    data: { id: 'tmpl-1', slug: payload.slug },
                    error: null,
                  }),
                ),
              })),
            };
          }),
        };
      }),
    };
    const supabase = { getClient: () => client } as unknown as SupabaseService;

    const service = new ReportsService(
      supabase,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
    );

    const result = await service.saveBuilderTemplate('user-1234abcd', {
      title: 'My Layout',
      user_type: 'investor',
      sections: [{ id: 's1', type: 'report_title' }],
    });

    expect(result).toEqual({
      id: 'tmpl-1',
      slug: expect.stringContaining('custom-user-123'),
    });
    expect(insertPayloads).toHaveLength(1);
    expect(insertPayloads[0]).toMatchObject({
      name: 'My Layout',
      is_public: false,
      is_active: true,
      created_by: 'user-1234abcd',
      config: {
        sections: [{ id: 's1', type: 'report_title' }],
        userType: 'investor',
      },
    });
  });
});
