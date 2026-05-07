import { bootstrapE2EContext, E2EContext } from './helpers';

const runDashboard = process.env.RUN_P3_DASHBOARD_MAGNETS_E2E === 'true';
const describeFn = runDashboard ? describe : describe.skip;

describeFn('E2E: content-pipeline P3 dashboard magnets service', () => {
  let ctx: E2EContext;

  beforeAll(async () => {
    ctx = await bootstrapE2EContext();
  }, 60_000);

  afterAll(async () => {
    await ctx.app.close();
  }, 30_000);

  it('lists delivered magnets with signed download URLs', async () => {
    const client = ctx.supabase.getClient();
    const userId = `e2e-user-${Date.now()}`;

    // Minimal user profile required by refresh() and for realism.
    await client.from('user_profiles').upsert({
      id: userId,
      email: `e2e-${Date.now()}@example.com`,
      full_name: 'E2E User',
    });

    const storageUrl = `supabase://content-pipeline/lead-magnets/${userId}/e2e.pdf`;
    const { data: asset } = await client
      .from('content_assets')
      .insert({
        run_id: null,
        kind: 'pdf_lead_magnet',
        storage_url: storageUrl,
        metadata: { magnetKind: 'market_snapshot_pdf', userId },
      })
      .select('id')
      .single();
    if (!asset?.id) throw new Error('failed to seed pdf asset');

    await client.from('lead_magnet_deliveries').insert({
      user_id: userId,
      magnet_kind: 'market_snapshot_pdf',
      resolved_geo: {
        geography: 'metro',
        id: '17460',
        canonical_name: 'Cleveland, OH',
      },
      pdf_asset_id: asset.id,
    });

    const magnets = await ctx.dashboardMagnets.getUserMagnets(userId);
    expect(magnets.length).toBeGreaterThanOrEqual(1);
    expect(magnets[0]?.pdf_download_url).toContain('/storage/v1/object/sign/');
  }, 120_000);
});

