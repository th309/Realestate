import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  // Total County records
  const { count: totalRecords } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'County');

  console.log('Total County records in zillow_zhvi:', totalRecords);

  // Get ALL unique region_ids for County using pagination
  console.log('\nFetching all unique County region_ids with full pagination...');
  let allIds: string[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('zillow_zhvi')
      .select('region_id')
      .eq('geography', 'County')
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.log('Error at offset', offset, ':', error.message);
      break;
    }

    if (!data || data.length === 0) {
      console.log(`Page at offset ${offset}: 0 records, stopping`);
      break;
    }

    allIds = allIds.concat(data.map(r => r.region_id));
    console.log(`Page at offset ${offset}: ${data.length} records, total fetched: ${allIds.length}`);
    offset += pageSize;

    if (data.length < pageSize) {
      break;
    }
  }

  const uniqueIds = [...new Set(allIds)];
  console.log('\n=== Results ===');
  console.log('Total fetched records:', allIds.length);
  console.log('Unique county region_ids:', uniqueIds.length);

  // Check CA counties
  const caFips = uniqueIds.filter(id => id.startsWith('06'));
  console.log('\nCA counties (06xxx):', caFips.length);

  // Check format
  const fipsFormat = uniqueIds.filter(id => /^\d{5}$/.test(id));
  const otherFormat = uniqueIds.filter(id => !/^\d{5}$/.test(id));
  console.log('FIPS format (5-digit):', fipsFormat.length);
  console.log('Other format:', otherFormat.length);

  if (caFips.length < 58) {
    console.log('\nMissing CA counties:');
    const allCaFips = [
      '06001', '06003', '06005', '06007', '06009', '06011', '06013', '06015',
      '06017', '06019', '06021', '06023', '06025', '06027', '06029', '06031',
      '06033', '06035', '06037', '06039', '06041', '06043', '06045', '06047',
      '06049', '06051', '06053', '06055', '06057', '06059', '06061', '06063',
      '06065', '06067', '06069', '06071', '06073', '06075', '06077', '06079',
      '06081', '06083', '06085', '06087', '06089', '06091', '06093', '06095',
      '06097', '06099', '06101', '06103', '06105', '06107', '06109', '06111',
      '06113', '06115'
    ];
    const missing = allCaFips.filter(f => !caFips.includes(f));
    console.log('Missing from zillow_zhvi:', missing.length);
    console.log(missing);
  }

  // Check if LA County is there
  console.log('\nLA County (06037) present:', uniqueIds.includes('06037'));
}

check().catch(console.error);
