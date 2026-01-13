
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function checkCounts() {
    const { count } = await supabase.from('zillow_zori').select('*', { count: 'exact', head: true });
    console.log('Total records:', count);

    const { data: geos } = await supabase.from('zillow_zori').select('geography, property_type').limit(2000);
    // manual distinct count
    const dist = new Set(geos?.map(g => `${g.geography}|${g.property_type}`));
    console.log('Distinct Geo|Type:', Array.from(dist));
}

checkCounts();
